"""
Builds public/models/umc500.glb, the rigged HAAS UMC-500 the simulator loads,
from Haas's CAD in assets/cad/: the solid models published on the machine's
page (tessellated by tools/cad/step_to_glb.py) for every part they have, and
the lighter configurator export for the standard parts they lack.

    blender -b --factory-startup --python tools/blender/build_umc500.py
    blender -b --factory-startup --python tools/blender/build_umc500.py -- --preview <dir>

Run it from Blender's Scripting tab instead to get the built scene open for
inspection (set CNC_SIM_REPO if the text block is not saved inside the repo).

Each CAD file is several factory options overlaid in one assembly: tool
changers, two spindles, three chip conveyors, two coolant tanks and several
table tops, all occupying the same space. This script

  1. keeps one standard configuration, each part from the finest model that
     has it, and stands it upright (Z up, front -Y);
  2. splits the trunnion into its fixed base and the tilting cradle, and puts
     every moving part under a pivot on its real axis (X/Y/Z, B tilt, C table,
     spindle, door);
  3. cuts the CAD's controls off the pendant face and replaces them with
     separate, labelled, pressable ones, a screen and a status beacon;
  4. adds what the CAD leaves out: the air regulator with its gauge and shut-off
     valve on the rear panel, the main disconnect on the electrical cabinet,
     and a riser with a 5-axis vise on the platter for the stock.

Contract with the app (src/widgets/vr-scene/machine-rig.ts):
  - a node the trainee can point at carries a `part` custom property, exported
    as glTF extras; a hit resolves to the nearest ancestor that has one;
  - every part the tutorial can highlight has an `Anchor_<part>` empty whose
    local +Z points out of the surface (local +Y once in three.js);
  - moving nodes keep the fixed names listed in RIG_NODES below.

All coordinates are metres in the CAD frame after it is stood up: floor at
Z = 0, front of the machine towards -Y. Values marked "measured" were read off
orthographic renders and ray casts against the CAD, not guessed.
"""

import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


def repo_root() -> Path:
    env = os.environ.get("CNC_SIM_REPO")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    if here.is_file():
        return here.parents[2]
    raise SystemExit("Set CNC_SIM_REPO to the repository root.")


REPO = repo_root()
SRC = REPO / "assets" / "cad" / "UMC-500_SS_02_2026.glb"
# Haas's solid model, tessellated by tools/cad/step_to_glb.py. Not in git (the
# STEP is 50 MB): download "3D Model w/SMTC-120 (ZIP)" from the UMC-500 page
# on haascnc.com into assets/cad/haas-smtc120/ and convert it — the README's
# Model section has the commands. Without it the build falls back to the
# configurator model alone.
SOLID = REPO / "assets" / "cad" / "haas-smtc120" / "umc500-smtc120.glb"
# The 10-pallet-pool model ("3D Model w/10+1 Pallet Pool (ZIP)", into
# assets/cad/haas-pp10/) is the only one with the standard side-mount
# changer's arm and cam box; optional like SOLID.
SOLID_PP = REPO / "assets" / "cad" / "haas-pp10" / "umc500-pp10.glb"
OUT = REPO / "public" / "models" / "umc500.glb"

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW_DIR = ARGS[ARGS.index("--preview") + 1] if "--preview" in ARGS else None

# The configurator's floor sits at Y = -0.897 in the source file.
CAD_FLOOR = 0.897

# The solid model's parts, by STEP occurrence: OpenCascade names each glTF
# node NAUO<n> after it (the part names are in the .inventory.json beside the
# GLB). Identified from renders of each part (part 12 and 13 are the CAT40 and
# HSK spindles, 23 and 24 the 55 and 95 gallon tanks). Not taken: 3 the anchor pattern, 5 a fixture
# plate, 6 the blank platter, 13 the HSK spindle, 15 the solid model's own
# pendant (ours is measured on the configurator's), 16-18 chip conveyors,
# 20-22 and 26 the 120-pocket chain changer and its arm and frame, 24 the
# 95 gallon tank, 25 its enclosure, which is cut for the 120-pocket changer.
SOLID_PARTS = {
    1: "base",
    2: "pads",
    4: "trunnion",
    7: "platter",
    8: "wips",
    9: "saddle_x",
    10: "ram_y",
    11: "head_z",
    12: "spindle",
    14: "side_window",
    19: "door",
    23: "tank",
}
# From the pallet-pool model only the changer arm with its cam box: it lies
# on the configurator's to within 2 mm and has six times its triangles.
SOLID_PP_PARTS = {13: "tc_arm"}
# The configurator model supplies the rest of the standard configuration: the
# enclosure with the 30+1 side-mount changer's opening (the solid models' are
# cut for their own changers, and no finer), the 30-pocket carousel, and the
# pendant our controls were measured on.

# CAD mesh name (minus Blender's .NNN suffix) -> role. Anything not listed is
# an alternative option and is dropped.
CAD_PARTS = {
    "UMC 500- Base Casting": "base",
    "umc 500- Leveling Pads": "pads",
    "UMC 500- Trunnion": "trunnion",
    "UMC 500-T Slot Platter": "platter",
    "UMC 500- X Axis": "saddle_x",
    "UMC 500- Y Axis": "ram_y",
    "UMC 500- Z Axis": "head_z",
    "UMC 500- 40 Taper Spindle": "spindle",
    "UMC-500- Tool Changer Arm Up": "tc_arm",
    "UMC 500- 30 Pkt Tool Changer": "tool_changer",
    "UMC 500- Enclosure": "enclosure",
    "UMC 500- Auto Window": "side_window",
    "UMC 500- Control Panel": "pendant",
    "umc 500- 55 gallon tank": "tank",
    "UMC-500-Auto Door": "door",
}

# Nodes the app animates. Renaming one here means renaming it in machine-rig.ts.
RIG_NODES = (
    "Axis_X", "Axis_Y", "Axis_Z", "Spindle", "Axis_B", "Axis_C",
    "Door", "EStop", "Handwheel", "AirValve_Lever", "AirGauge_Needle",
    "MainSwitch_Handle", "Beacon", "Screen", "Coolant_Nozzle", "Tool_Tip",
    "Stock_Mount", "Vise_JawNeg", "Vise_JawPos",
    "ToolChanger_Carousel", "ToolChanger_Arm", "ArmGrip_A", "ArmGrip_B",
    # ...plus Pocket_01..30 and PocketTool_01..30, checked in build().
)

# --- measured geometry -------------------------------------------------------

# Pivots.
B_AXIS = Vector((0.0, -0.533, 0.897))  # trunnion bearing centres, along Y
C_AXIS = Vector((0.0, -0.533, 0.849))  # platter centre, top face
SPINDLE_AXIS = Vector((0.252, -0.3285, 1.229))
SPINDLE_NOSE_Z = 1.098

# Front door: frame face, handle on the right edge.
DOOR_CENTER = Vector((-0.149, -1.095, 1.357))
DOOR_WINDOW = (-0.376, 0.088, 1.029, 1.804)  # x0, x1, z0, z1 of the glass pane
DOOR_GLASS_Y = (-1.0696, -1.0664)
DOOR_HANDLE = Vector((0.175, -1.166, 1.205))

# Side automation window glass (x-facing pane).
SIDE_GLASS = ((0.709, 0.718), (-0.84, -0.19), (0.789, 1.707))

# Pendant: screen face plane, then the controls on it (x, z).
PENDANT_FACE_Y = -1.321
KEYBOARD_RECT = (0.4088, 0.7113, 1.247, 1.4426)
KEYBOARD_PLANE_Y = -1.3241
LEFT_COLUMN_RECT = (0.279, 0.395, 1.236, 1.632)
SCREEN_RECT = (0.4088, 0.7153, 1.4769, 1.7310)
POWER_ON = (0.3104, 1.5946)
POWER_OFF = (0.3645, 1.5946)
ESTOP = (0.3371, 1.4970)
HANDWHEEL = (0.3371, 1.3800)
CYCLE_START = (0.3104, 1.2672)
FEED_HOLD = (0.3645, 1.2672)

# Work-holding on the platter (table frame, metres above the platter top).
VISE_RISER = 0.055
VISE_TOP = 0.100
JAW_GRIP = 0.008

# Side-mount tool changer (docs/haas-ngc/smtc.md). The carousel is a wheel on
# the left wall turning about an X axis; its pockets hold the tools level,
# cutters pointing out at the wall. The pocket at the bottom (the station) tilts
# down to hang its tool vertically under the double arm, which turns about a
# vertical axis halfway between that pocket and the spindle at the tool-change
# position (X-610 Y-82 Z0). Measured off the CAD's pocket ends and arm plate.
TC_POCKETS = 30
TC_CAROUSEL_AXIS = Vector((-0.865, -0.4105, 1.742))  # a point on the axis (along X)
TC_POCKET_RADIUS = 0.3205
TC_POCKET_MOUTH_X = -1.014  # gauge line of a tool in a pocket
TC_POCKET_INNER_X = -0.885
TC_POCKET_BORE = 0.031  # sleeve radius: a CAT40 flange (63.5 mm) covers the mouth
TC_ARM_PIVOT = Vector((-0.611, -0.4105, 1.357))  # at the spindle gauge line, Z0
TC_ARM_REACH = 0.3055
# The station pocket tilts about this point so that, hanging down, its tool's
# gauge line lands under the arm's far end: TC_ARM_PIVOT - (TC_ARM_REACH, 0, 0).
TC_POCKET_PIVOT = Vector((-0.93275, -0.4105, 1.43825))

# Rear panel and electrical cabinet faces.
REAR_FACE_Y = 1.1485
AIR_SUPPLY = Vector((0.40, REAR_FACE_Y, 1.15))
CABINET_FACE_X = 1.0369
MAIN_SWITCH = Vector((CABINET_FACE_X, 0.70, 1.35))

# --- materials ---------------------------------------------------------------


def srgb(hex_color: str):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    h = hex_color.lstrip("#")
    return tuple(lin(int(h[i : i + 2], 16)) for i in (0, 2, 4))


def material(name, color, metallic=0.0, roughness=0.5, alpha=1.0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = srgb(color)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = (*rgb, alpha)
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*srgb(emission), 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


def build_materials():
    return {
        "sheet": material("M_Sheet", "#d3d6d9", 0.1, 0.5),
        "door": material("M_DoorFrame", "#c4c8cc", 0.1, 0.45),
        "glass": material("M_Glass", "#9fb8c8", 0.0, 0.05, alpha=0.22),
        # Haas castings are painted grey; with the solid model's ribs and
        # bosses they read as parts only if they are not near-black.
        "casting": material("M_Casting", "#5c6168", 0.15, 0.6),
        "casting_light": material("M_CastingLight", "#7a8188", 0.2, 0.5),
        "trunnion": material("M_Trunnion", "#b3b9bf", 0.3, 0.42),
        "head": material("M_Head", "#9ba2a9", 0.25, 0.45),
        "steel": material("M_Steel", "#b9bfc6", 0.85, 0.3),
        "carbide": material("M_Carbide", "#3d4146", 0.7, 0.35),
        "rubber": material("M_Rubber", "#1b1c1e", 0.0, 0.8),
        "pendant": material("M_PendantBody", "#2e3136", 0.1, 0.55),
        "fascia": material("M_Fascia", "#24272b", 0.05, 0.6),
        "key_live": material("M_KeyLive", "#dfe1e3", 0.0, 0.55),
        "key_panel": material("M_KeyPanel", "#2f6fdc", 0.0, 0.5),
        "vise": material("M_ViseBody", "#3d4a57", 0.35, 0.45),
        "key_dummy": material("M_KeyDummy", "#9aa0a6", 0.0, 0.6),
        "key_label": material("M_KeyLabel", "#16181a", 0.0, 0.7),
        "label_light": material("M_LabelLight", "#f2f3f4", 0.0, 0.6),
        "bezel": material("M_Bezel", "#4a4f55", 0.7, 0.3),
        "green": material("M_BtnGreen", "#1f9d3a", 0.0, 0.35),
        "red": material("M_BtnRed", "#c62828", 0.0, 0.35),
        "amber": material("M_BtnAmber", "#e08a1e", 0.0, 0.35),
        "estop_red": material("M_EStopRed", "#d01f1f", 0.0, 0.3),
        "yellow": material("M_SafetyYellow", "#f2c200", 0.0, 0.45),
        "screen": material("M_Screen", "#0b0f14", 0.0, 0.2, emission="#000000"),
        "screen_bezel": material("M_ScreenBezel", "#0d0e10", 0.2, 0.25),
        "beacon": material("M_Beacon", "#3a3d40", 0.0, 0.25, emission="#000000"),
        "alu": material("M_Aluminium", "#b6bcc2", 0.8, 0.35),
        "bowl": material("M_Bowl", "#c8d8e0", 0.0, 0.1, alpha=0.45),
        "gauge_face": material("M_GaugeFace", "#f4f4f2", 0.0, 0.6),
        "plate": material("M_MountPlate", "#3a3f45", 0.3, 0.55),
        "valve_lever": material("M_ValveLever", "#c62828", 0.0, 0.45),
    }


# --- scene helpers -------------------------------------------------------------

COLL = None
FONT = None


def link(ob, parent=None, local=None):
    COLL.objects.link(ob)
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix()
    ob.matrix_basis = local if local is not None else Matrix()
    return ob


def empty(name, parent=None, at=(0, 0, 0), size=0.03):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "ARROWS"
    ob.empty_display_size = size
    return link(ob, parent, Matrix.Translation(at))


def frame(name, origin, right, up, parent=None):
    """An empty whose local X/Y/Z are (right, up, out of the surface)."""
    right = Vector(right).normalized()
    up = Vector(up).normalized()
    out = right.cross(up)
    rot = Matrix((right, up, out)).transposed().to_4x4()
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "ARROWS"
    ob.empty_display_size = 0.05
    return link(ob, parent, Matrix.Translation(origin) @ rot)


def anchor(part, parent, at, arrow_scale=1.0, tilt_x=0.0, frontal=False):
    """`tilt_x` turns the anchor's out axis (+Z) about X, e.g. to look out of
    the door rather than straight up; `frontal` asks the camera to frame it
    square on instead of from an angle."""
    ob = empty(f"Anchor_{part}", parent, at, size=0.02)
    ob.rotation_euler = (math.radians(tilt_x), 0, 0)
    ob["anchorFor"] = part
    ob["arrowScale"] = arrow_scale
    if frontal:
        ob["frontal"] = True
    return ob


def reparent_keep_world(ob, parent):
    bpy.context.view_layer.update()
    world = ob.matrix_world.copy()
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix()
    ob.matrix_basis = parent.matrix_world.inverted() @ world


def text_mesh(body, size, align="CENTER"):
    cu = bpy.data.curves.new("label", "FONT")
    cu.font = FONT
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.resolution_u = 2
    ob = bpy.data.objects.new("label", cu)
    COLL.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return me


class Geo:
    """One object's geometry, built from primitives in its own local frame
    (X right, Y up, Z out of the surface it sits on)."""

    AXES = {
        "Z": Matrix(),
        "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
        "Y": Matrix.Rotation(-math.pi / 2, 4, "X"),
    }

    def __init__(self):
        self.bm = bmesh.new()

    def _tag(self, verts, mat, smooth):
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mat
            f.smooth = smooth and len(f.verts) == 4

    def box(self, size, at, mat=0, rot_z=0.0):
        m = (
            Matrix.Translation(at)
            @ Matrix.Rotation(rot_z, 4, "Z")
            @ Matrix.Diagonal((*size, 1.0))
        )
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._tag(r["verts"], mat, False)

    def cyl(self, radius, depth, at, mat=0, axis="Z", segments=24, radius2=None, smooth=True):
        m = Matrix.Translation(at) @ self.AXES[axis]
        r = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=segments,
            radius1=radius,
            radius2=radius if radius2 is None else radius2,
            depth=depth,
            matrix=m,
        )
        self._tag(r["verts"], mat, smooth)

    def tube(self, outer, inner, depth, floor, at, mat=0, axis="Z", segments=24):
        """A sleeve open at its local -Z end: the outer wall, the bore down to
        a floor `floor` short of the closed end, and the ring between them at
        the mouth."""
        m = Matrix.Translation(at) @ self.AXES[axis]
        steps = [2 * math.pi * k / segments for k in range(segments)]

        def ring(r, z):
            return [self.bm.verts.new(m @ Vector((r * math.cos(a), r * math.sin(a), z))) for a in steps]

        o0, o1 = ring(outer, -depth / 2), ring(outer, depth / 2)
        i0, i1 = ring(inner, -depth / 2), ring(inner, depth / 2 - floor)
        walls = []
        for k in range(segments):
            n = (k + 1) % segments
            walls.append(self.bm.faces.new((o0[k], o0[n], o1[n], o1[k])))
            walls.append(self.bm.faces.new((i0[n], i0[k], i1[k], i1[n])))
            self.bm.faces.new((o0[k], i0[k], i0[n], o0[n])).material_index = mat
        for f in walls:
            f.material_index = mat
            f.smooth = True
        self.bm.faces.new(o1).material_index = mat
        self.bm.faces.new(list(reversed(i1))).material_index = mat

    def text(self, body, size, at, mat=0, align="CENTER"):
        me = text_mesh(body, size, align)
        src = bmesh.new()
        src.from_mesh(me)
        vmap = {v: self.bm.verts.new(v.co + Vector(at)) for v in src.verts}
        for f in src.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = mat
        src.free()
        bpy.data.meshes.remove(me)

    def build(self, name, mats, parent, at=(0, 0, 0), part=None):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in mats:
            me.materials.append(m)
        ob = link(bpy.data.objects.new(name, me), parent, Matrix.Translation(at))
        if part:
            ob["part"] = part
        return ob


# --- CAD import and cleanup ----------------------------------------------------


def stand_up_matrix():
    # Both models are Y-up with the front towards +Z and the floor 0.897 m
    # below their origin (Haas sets the origin where the Z and Y ballscrews
    # cross). Stand them up: Z up, front -Y, floor at zero. The two then
    # coincide to the millimetre — the configurator model is made from the
    # same solid model.
    return Matrix.Translation((0, 0, CAD_FLOOR)) @ Matrix.Rotation(math.radians(90), 4, "X")


def adopt(ob, matrix):
    """Bake `matrix` into the mesh, unparent it, and file it in the scene."""
    ob.data.transform(matrix @ ob.matrix_world)
    ob.parent = None
    ob.matrix_world = Matrix()
    for coll in list(ob.users_collection):
        coll.objects.unlink(ob)
    COLL.objects.link(ob)


def import_cad():
    solids = [(path, roles) for path, roles in ((SOLID, SOLID_PARTS), (SOLID_PP, SOLID_PP_PARTS)) if path.exists()]
    for path in (SOLID, SOLID_PP):
        if not path.exists():
            print(f"note: {path.name} not found, its parts come from the configurator model")
    from_solid = {role for _path, roles in solids for role in roles.values()}
    stand_up = stand_up_matrix()

    bpy.ops.import_scene.gltf(filepath=str(SRC))
    bpy.context.view_layer.update()
    parts = {}
    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            continue
        role = CAD_PARTS.get(ob.data.name.rsplit(".", 1)[0])
        if role is None or role in from_solid:
            bpy.data.objects.remove(ob)
            continue
        adopt(ob, stand_up)
        parts[role] = ob
    for ob in [o for o in bpy.data.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(ob)

    for path, roles in solids:
        kept = set(parts.values())
        bpy.ops.import_scene.gltf(filepath=str(path))
        bpy.context.view_layer.update()
        found = {}
        for ob in [o for o in bpy.data.objects if o.type == "MESH" and o not in kept]:
            role = roles.get(solid_occurrence(ob))
            if role is None:
                bpy.data.objects.remove(ob)
                continue
            adopt(ob, stand_up)
            found.setdefault(role, []).append(ob)
        for ob in [o for o in bpy.data.objects if o.type == "EMPTY"]:
            bpy.data.objects.remove(ob)
        for role, obs in found.items():
            parts[role] = join(obs, role)
    if "wips" in parts:
        # The tool-setting probe is a few centimetres of very finely
        # tessellated detail; a tenth of its triangles reads the same.
        decimate(parts["wips"], 0.12)

    expected = set(CAD_PARTS.values()) | from_solid
    missing = expected - set(parts)
    if missing:
        raise SystemExit(f"CAD is missing parts: {sorted(missing)}")
    return parts


def solid_occurrence(ob):
    """The NAUO number of the STEP occurrence a mesh belongs to."""
    p = ob
    while p:
        if p.name.upper().startswith("NAUO"):
            digits = "".join(ch for ch in p.name[4:] if ch.isdigit())
            return int(digits) if digits else None
        p = p.parent
    return None


def join(obs, name):
    """One object for a part the solid model splits into several meshes."""
    if len(obs) == 1:
        obs[0].name = name
        return obs[0]
    with bpy.context.temp_override(active_object=obs[0], selected_editable_objects=obs, selected_objects=obs):
        bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


def bevel_edges(ob, width, segments, angle=math.radians(35)):
    """Rounds every edge sharper than `angle`, keeping the faces flat."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(ob.data)
    bm.free()
    mod = ob.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = angle
    mod.harden_normals = True
    mod.use_clamp_overlap = True
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def decimate(ob, ratio):
    mod = ob.modifiers.new("decimate", "DECIMATE")
    mod.ratio = ratio
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def components(bm):
    """Connected vertex islands of a bmesh."""
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, island = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop()
            island.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index)
                    stack.append(b)
        out.append(island)
    return out


def split_trunnion(trunnion):
    """The CAD trunnion is one mesh: the fixed rear drive housing and front
    bearing stand, plus the cradle that tilts between them. Islands whose
    centroid lies between the two bearings are the cradle."""
    cradle = trunnion.copy()
    cradle.data = trunnion.data.copy()
    COLL.objects.link(cradle)

    def keep(ob, want_cradle):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.verts.ensure_lookup_table()
        doomed = []
        for island in components(bm):
            cy = sum(v.co.y for v in island) / len(island)
            is_cradle = -0.90 < cy < -0.03
            if is_cradle != want_cradle:
                doomed.extend(island)
        bmesh.ops.delete(bm, geom=doomed, context="VERTS")
        bm.to_mesh(ob.data)
        bm.free()

    keep(trunnion, want_cradle=False)
    keep(cradle, want_cradle=True)
    return trunnion, cradle


def strip_faces(ob, doomed_fn):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    doomed = [f for f in bm.faces if doomed_fn(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    return len(doomed)


def split_off(ob, pick_fn, name):
    """Moves the faces of `ob` whose centre `pick_fn` accepts into a new
    object; `ob` keeps the rest."""
    part = ob.copy()
    part.data = ob.data.copy()
    part.name = name
    COLL.objects.link(part)
    strip_faces(part, lambda c: not pick_fn(c))
    strip_faces(ob, pick_fn)
    return part


def pivot(name, parent, matrix, size=0.02):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "ARROWS"
    ob.empty_display_size = size
    return link(ob, parent, matrix)


def assign_faces(ob, mat_index, pick_fn):
    for poly in ob.data.polygons:
        if pick_fn(Vector(poly.center)):
            poly.material_index = mat_index


def in_rect(c, rect, a="x", b="z"):
    x0, x1, z0, z1 = rect
    return x0 <= getattr(c, a) <= x1 and z0 <= getattr(c, b) <= z1


def surface_y(ob, x, z):
    """Front-most face of `ob` at (x, z), looking from the operator's side."""
    hit, loc, _n, _i = ob.ray_cast(Vector((x, -5.0, z)), Vector((0, 1, 0)))
    if not hit:
        raise SystemExit(f"no surface on {ob.name} at x={x} z={z}")
    return loc.y


def set_mats(ob, *mats):
    ob.data.name = ob.name
    ob.data.materials.clear()
    for m in mats:
        ob.data.materials.append(m)


# --- build -------------------------------------------------------------------


def build():
    global COLL, FONT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    COLL = bpy.context.scene.collection
    FONT = bpy.data.fonts.load("<builtin>")
    M = build_materials()

    cad = import_cad()
    root = empty("UMC500", size=0.3)

    # Static shell.
    for role, name, mats in (
        ("enclosure", "Enclosure", ["sheet"]),
        ("base", "Base", ["casting"]),
        ("pads", "LevelingPads", ["rubber"]),
        ("tank", "CoolantTank", ["casting"]),
        ("wips", "ToolSetter", ["steel"]),
    ):
        if role not in cad:
            continue
        ob = cad[role]
        ob.name = name
        set_mats(ob, *(M[m] for m in mats))
        reparent_keep_world(ob, root)
    cad["enclosure"]["part"] = "enclosure"
    # Folded sheet metal has rounded edges that catch the light; the
    # configurator's panels meet at knife edges, which is most of why the
    # enclosure read as a box.
    bevel_edges(cad["enclosure"], 0.006, 2)
    build_tool_changer(cad["tool_changer"], cad["tc_arm"], root, M)

    side = cad["side_window"]
    side.name = "SideWindow"
    set_mats(side, M["door"], M["glass"])
    (gx0, gx1), (gy0, gy1), (gz0, gz1) = SIDE_GLASS
    assign_faces(side, 1, lambda c: gx0 <= c.x <= gx1 and gy0 <= c.y <= gy1 and gz0 <= c.z <= gz1)
    reparent_keep_world(side, root)

    # Motion chain: the X saddle carries the Y ram, which carries the Z head,
    # which carries the spindle. All pivots are unrotated, so a node's local
    # axes are the machine's.
    axis_x = empty("Axis_X", root)
    axis_y = empty("Axis_Y", axis_x)
    axis_z = empty("Axis_Z", axis_y)
    axis_z["part"] = "spindle"
    spindle = empty("Spindle", axis_z, SPINDLE_AXIS)
    for role, name, parent, mat in (
        ("saddle_x", "SaddleX", axis_x, "casting_light"),
        ("ram_y", "RamY", axis_y, "casting_light"),
        ("head_z", "HeadZ", axis_z, "head"),
        ("spindle", "SpindleNose", spindle, "steel"),
    ):
        ob = cad[role]
        ob.name = name
        set_mats(ob, M[mat])
        reparent_keep_world(ob, parent)

    # A tool in the spindle, with a flat on the flange so rotation reads.
    tool = Geo()
    nose = SPINDLE_NOSE_Z - SPINDLE_AXIS.z
    tool.cyl(0.032, 0.016, (0, 0, nose - 0.008), 0, segments=32)
    tool.box((0.012, 0.010, 0.017), (0.030, 0, nose - 0.008), 1)
    tool.cyl(0.022, 0.040, (0, 0, nose - 0.036), 0, segments=24, radius2=0.016)
    tool.cyl(0.017, 0.015, (0, 0, nose - 0.0635), 0, segments=24)
    tool.cyl(0.006, 0.045, (0, 0, nose - 0.0935), 2, segments=12)
    tool.build("Tool", [M["steel"], M["casting"], M["carbide"]], spindle)
    tip_z = SPINDLE_NOSE_Z - 0.116
    empty("Tool_Tip", axis_z, (SPINDLE_AXIS.x, SPINDLE_AXIS.y, tip_z), size=0.01)
    empty(
        "Coolant_Nozzle",
        axis_z,
        (SPINDLE_AXIS.x + 0.07, SPINDLE_AXIS.y - 0.06, SPINDLE_NOSE_Z + 0.03),
        size=0.01,
    )

    # Trunnion: fixed base, cradle tilting about Y (Haas B axis), platter
    # rotating on the cradle (C axis).
    base, cradle = split_trunnion(cad["trunnion"])
    base.name = "TrunnionBase"
    cradle.name = "TrunnionCradle"
    set_mats(base, M["trunnion"])
    set_mats(cradle, M["trunnion"])
    reparent_keep_world(base, root)
    axis_b = empty("Axis_B", root, B_AXIS)
    axis_b["part"] = "trunnion"
    reparent_keep_world(cradle, axis_b)
    axis_c = empty("Axis_C", axis_b, C_AXIS - B_AXIS)
    platter = cad["platter"]
    platter.name = "Platter"
    set_mats(platter, M["steel"])
    reparent_keep_world(platter, axis_c)
    build_vise(axis_c, M)

    build_door(cad["door"], root, M)
    build_pendant(cad["pendant"], root, M)
    build_air_supply(root, M)
    build_main_switch(root, M)

    # Centre the footprint on the origin so the app can place the machine by
    # its middle.
    enc = cad["enclosure"]
    bpy.context.view_layer.update()
    pts = [enc.matrix_world @ Vector(c) for c in enc.bound_box]
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    root.location = (-round(cx, 4), -round(cy, 4), 0)

    pockets = [f"{k}_{p:02d}" for p in range(1, TC_POCKETS + 1) for k in ("Pocket", "PocketTool")]
    for name in (*RIG_NODES, *pockets):
        if name not in bpy.data.objects:
            raise SystemExit(f"rig node {name} was not built")
    return root


def build_tool_changer(changer, arm_cad, root, M):
    """The SMTC split into what moves: the carousel turning on its axis, a
    pocket at each of its 30 places that tilts down when it is at the station,
    and the double arm turning and dropping on its own axis. Every pocket and
    both ends of the arm carry an empty the app hangs a tool from: its origin
    is the tool's gauge line and its local +Z points from the tip back to the
    taper (three.js +Y, the way a tool hangs from the spindle)."""
    ax = TC_CAROUSEL_AXIS

    def ring(c):
        return math.hypot(c.y - ax.y, c.z - ax.z)

    # The CAD's pocket sleeves are one with the wheel; they are rebuilt below,
    # one per pocket, so each can tilt on its own.
    removed = strip_faces(changer, lambda c: c.x < TC_POCKET_INNER_X and 0.285 < ring(c) < 0.355)
    wheel = split_off(changer, lambda c: c.x < -0.845, "CarouselWheel")
    changer.name = "ToolChanger"
    set_mats(changer, M["head"])
    changer["part"] = "tool_changer"
    reparent_keep_world(changer, root)

    carousel = empty("ToolChanger_Carousel", root, ax)
    carousel["part"] = "tool_changer"
    set_mats(wheel, M["head"])
    reparent_keep_world(wheel, carousel)

    step = 2 * math.pi / TC_POCKETS
    at_station = TC_POCKET_PIVOT - ax
    mouth = Vector((TC_POCKET_MOUTH_X, ax.y, ax.z - TC_POCKET_RADIUS)) - TC_POCKET_PIVOT
    length = TC_POCKET_INNER_X - TC_POCKET_MOUTH_X
    for p in range(1, TC_POCKETS + 1):
        # Pocket p sits p - 1 steps round from the station about +X, so turning
        # the carousel by -(p - 1) steps brings it down to the arm.
        turn = Matrix.Rotation((p - 1) * step, 4, "X")
        pocket = pivot(f"Pocket_{p:02d}", carousel, turn @ Matrix.Translation(at_station))
        sleeve = Geo()
        # One material: thirty pockets are thirty draw calls, not sixty.
        # Open at the mouth like the solid model's pockets: an empty pocket
        # shows its bore, a full one the tool's flange over it.
        sleeve.tube(TC_POCKET_BORE, TC_POCKET_BORE - 0.007, length, 0.03, (mouth.x + length / 2, 0, mouth.z), 0, axis="X")
        sleeve.box((0.012, 0.016, 0.010), (mouth.x + 0.010, 0, mouth.z + TC_POCKET_BORE), 0)
        sleeve.build(f"PocketSleeve_{p:02d}", [M["casting_light"]], pocket)
        pivot(f"PocketTool_{p:02d}", pocket, Matrix.Translation(mouth) @ Matrix.Rotation(math.pi / 2, 4, "Y"))

    # The double arm is the plate and hub under the cam box.
    arm_mesh = split_off(
        arm_cad,
        lambda c: c.z < 1.405 and math.hypot(c.x - TC_ARM_PIVOT.x, c.y - TC_ARM_PIVOT.y) < 0.33,
        "ToolChangerArm",
    )
    arm_cad.name = "ToolChangerCambox"
    set_mats(arm_cad, M["casting_light"])
    arm_cad["part"] = "tool_changer"
    reparent_keep_world(arm_cad, root)
    arm = empty("ToolChanger_Arm", root, TC_ARM_PIVOT)
    arm["part"] = "tool_changer"
    set_mats(arm_mesh, M["casting_light"])
    reparent_keep_world(arm_mesh, arm)
    # Home is along Y; turned -90 deg about Z, end A is over the spindle.
    empty("ArmGrip_A", arm, (0, TC_ARM_REACH, 0), size=0.02)
    empty("ArmGrip_B", arm, (0, -TC_ARM_REACH, 0), size=0.02)
    print(f"tool changer: removed {removed} CAD pocket faces, {len(arm_mesh.data.polygons)} arm faces")


def build_door(door, root, M):
    pivot = frame("Door", DOOR_CENTER, (1, 0, 0), (0, 0, 1), root)
    pivot["part"] = "door"
    door.name = "DoorPanel"
    set_mats(door, M["door"], M["glass"], M["steel"])
    y0, y1 = DOOR_GLASS_Y
    assign_faces(door, 1, lambda c: in_rect(c, DOOR_WINDOW) and y0 <= c.y <= y1)
    assign_faces(door, 2, lambda c: c.y < DOOR_CENTER.y - 0.0005)
    reparent_keep_world(door, pivot)
    handle = DOOR_HANDLE - DOOR_CENTER
    anchor("door", pivot, (handle.x, handle.z, -handle.y + 0.01))


def build_pendant(cad_pendant, root, M):
    pend = frame("Pendant", (0, PENDANT_FACE_Y, 0), (1, 0, 0), (0, 0, 1), root)

    def out_of(world_y):
        return PENDANT_FACE_Y - world_y

    # Where the CAD's own face sits under each control group.
    left_face = max(
        surface_y(cad_pendant, x, z)
        for x, z in ((0.288, 1.545), (0.386, 1.545), (0.288, 1.32), (0.386, 1.32))
    )
    key_face = KEYBOARD_PLANE_Y
    eps = 0.0005
    removed = strip_faces(
        cad_pendant,
        lambda c: (in_rect(c, LEFT_COLUMN_RECT) and c.y < left_face - eps)
        or (in_rect(c, KEYBOARD_RECT) and c.y < key_face - eps),
    )
    print(f"pendant: left face y={left_face:.4f}, removed {removed} CAD control faces")

    # The beacon on the CAD's top post.
    post = [cad_pendant.matrix_world @ v.co for v in cad_pendant.data.vertices]
    post = [p for p in post if p.z > 1.745 and p.x > 0.68]
    bx = (min(p.x for p in post) + max(p.x for p in post)) / 2
    by = (min(p.y for p in post) + max(p.y for p in post)) / 2
    br = (max(p.x for p in post) - min(p.x for p in post)) / 2
    top = max(p.z for p in post)

    cad_pendant.name = "PendantHousing"
    set_mats(cad_pendant, M["pendant"])
    cad_pendant["part"] = "pendant"
    reparent_keep_world(cad_pendant, pend)

    left_z = out_of(left_face)
    key_z = out_of(key_face)

    # Fascia plates cover the holes the CAD controls leave behind.
    fascia = Geo()
    for (x0, x1, z0, z1), z in ((LEFT_COLUMN_RECT, left_z), (KEYBOARD_RECT, key_z)):
        fascia.box((x1 - x0 + 0.004, z1 - z0 + 0.004, 0.002), ((x0 + x1) / 2, (z0 + z1) / 2, z + 0.001))
    fascia.build("PendantFascia", [M["fascia"]], pend)

    # Screen: a black bezel and a UV-mapped quad the app paints at runtime.
    x0, x1, z0, z1 = SCREEN_RECT
    sx, sz = (x0 + x1) / 2, (z0 + z1) / 2
    bezel = Geo()
    bezel.box((x1 - x0, z1 - z0, 0.001), (sx, sz, 0.0007))
    bezel.build("ScreenBezel", [M["screen_bezel"]], pend)
    sw, sh = (x1 - x0) - 0.014, (z1 - z0) - 0.016
    me = bpy.data.meshes.new("Screen")
    me.from_pydata(
        [(-sw / 2, -sh / 2, 0), (sw / 2, -sh / 2, 0), (sw / 2, sh / 2, 0), (-sw / 2, sh / 2, 0)],
        [],
        [(0, 1, 2, 3)],
    )
    uv = me.uv_layers.new(name="UVMap")
    for loop, coord in zip(me.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[loop.index].uv = coord
    me.materials.append(M["screen"])
    screen = link(bpy.data.objects.new("Screen", me), pend, Matrix.Translation((sx, sz, 0.0013)))
    screen["part"] = "screen"
    screen["aspect"] = round(sw / sh, 4)
    anchor("screen", pend, (sx, sz, 0.002), 0.6)

    beacon = Geo()
    beacon.cyl(br * 1.05, 0.045, (0, 0.0225, 0), 0, axis="Y", segments=24)
    beacon.build("Beacon", [M["beacon"]], pend, (bx, top, out_of(by)))

    # Round buttons: a static bezel, a pressable cap, a label above.
    labels = Geo()
    rings = Geo()
    for name, part, (x, z), mat, text in (
        ("Btn_PowerOn", "power_on", POWER_ON, "green", "POWER ON"),
        ("Btn_PowerOff", "power_off", POWER_OFF, "red", "POWER OFF"),
        ("Btn_CycleStart", "cycle_start", CYCLE_START, "green", "CYCLE START"),
        ("Btn_FeedHold", "feed_hold", FEED_HOLD, "amber", "FEED HOLD"),
    ):
        rings.cyl(0.0165, 0.004, (x, z, left_z + 0.003), 0, segments=32)
        cap = Geo()
        cap.cyl(0.0125, 0.007, (0, 0, 0.0035), 0, segments=32)
        cap.build(name, [M[mat]], pend, (x, z, left_z + 0.005), part=part)
        labels.text(text, 0.0042, (x, z + 0.0215, left_z + 0.0022))
        anchor(part, pend, (x, z, left_z + 0.013), 0.5)

    # E-stop: a yellow collar that stays put and a mushroom head that moves.
    ex, ez = ESTOP
    rings.cyl(0.036, 0.006, (ex, ez, left_z + 0.004), 1, segments=40)
    head = Geo()
    head.cyl(0.011, 0.016, (0, 0, 0.008), 0, segments=20)
    head.cyl(0.029, 0.016, (0, 0, 0.022), 0, segments=40, radius2=0.025)
    head.build("EStop", [M["estop_red"]], pend, (ex, ez, left_z + 0.007), part="estop")
    anchor("estop", pend, (ex, ez, left_z + 0.04), 0.6)

    # Jog handwheel: left half jogs minus, right half plus. The crank knob is
    # off-centre so a turn is visible.
    wx, wz = HANDWHEEL
    wheel = Geo()
    wheel.cyl(0.040, 0.010, (0, 0, 0.005), 0, segments=48)
    wheel.cyl(0.012, 0.006, (0, 0, 0.013), 0, segments=24)
    for i in range(25):
        a = i / 25 * 2 * math.pi
        wheel.box((0.0012, 0.006, 0.0006), (0.034 * math.sin(a), 0.034 * math.cos(a), 0.0103), 1, rot_z=-a)
    k = 0.027 / math.sqrt(2)
    wheel.cyl(0.0055, 0.016, (k, k, 0.018), 2, segments=16)
    wheel.build("Handwheel", [M["rubber"], M["label_light"], M["steel"]], pend, (wx, wz, left_z + 0.003), part="handwheel")
    labels.box((0.008, 0.0016, 0.0004), (wx - 0.050, wz, left_z + 0.0022))
    labels.box((0.008, 0.0016, 0.0004), (wx + 0.050, wz, left_z + 0.0022))
    labels.box((0.0016, 0.008, 0.0004), (wx + 0.050, wz, left_z + 0.0022))
    anchor("handwheel", pend, (wx, wz, left_z + 0.03), 0.6)

    rings.build("PendantBezels", [M["bezel"], M["yellow"]], pend)
    labels.build("PendantLabels", [M["label_light"]], pend)

    # Keyboard: 6 x 6 keys over the CAD keypad. Live keys are lighter; the rest
    # are there because a pendant with six keys is not a Haas pendant.
    kx0, kx1, kz0, kz1 = KEYBOARD_RECT
    pitch_x = (kx1 - kx0) / 6
    pitch_z = (kz1 - kz0) / 6
    layout = (
        (("RESET", "reset"), ("POWER\nUP", "power_up"), ("RECOVER", None), ("F1", None), ("F2", None), ("F3", None)),
        (("EDIT", None), ("MEMORY", "memory"), ("MDI", None), ("HANDLE\nJOG", "hand_jog"), ("ZERO\nRET", None), ("LIST\nPROG", None)),
        (("X", "axis_x"), ("Y", "axis_y"), ("Z", "axis_z"), ("B", "axis_b"), ("C", "axis_c"), ("COOLANT", "coolant")),
        (("7", None), ("8", None), ("9", None), ("PROGRAM", None), ("POSIT", None), ("OFFSET", None)),
        (("4", None), ("5", None), ("6", None), ("SETTING", None), ("ALARMS", None), ("HELP", None)),
        (("1", None), ("2", None), ("3", None), ("0", None), (".", None), ("FULL\nPANEL", "full_panel")),
    )
    dummies = Geo()
    for r, row in enumerate(layout):
        for c, (text, part) in enumerate(row):
            x = kx0 + pitch_x * (c + 0.5)
            z = kz1 - pitch_z * (r + 0.5)
            size = 0.0045 if "\n" in text else (0.0058 if len(text) <= 2 else 0.0042)
            if part:
                key = Geo()
                key.box((pitch_x - 0.005, pitch_z - 0.006, 0.005), (0, 0, 0.0025), 0)
                key.text(text, size, (0, 0, 0.0052), 1)
                name = "Key_" + "".join(w.capitalize() for w in part.split("_"))
                # Not a Haas key: it opens the app's full-size pendant, so it
                # is coloured apart from the real ones.
                mats = (
                    [M["key_panel"], M["label_light"]]
                    if part == "full_panel"
                    else [M["key_live"], M["key_label"]]
                )
                key.build(name, mats, pend, (x, z, key_z + 0.002), part=part)
                anchor(part, pend, (x, z, key_z + 0.009), 0.45)
            else:
                dummies.box((pitch_x - 0.005, pitch_z - 0.006, 0.005), (x, z, key_z + 0.0045), 0)
                dummies.text(text, size, (x, z, key_z + 0.0072), 1)
    dummies.build("PendantKeys", [M["key_dummy"], M["key_label"]], pend)


def build_air_supply(root, M):
    """Filter-regulator with gauge and a ball shut-off valve, on the rear panel
    where the shop air comes in."""
    air = frame("AirSupply", AIR_SUPPLY, (-1, 0, 0), (0, 0, 1), root)

    body = Geo()
    body.box((0.34, 0.30, 0.008), (0, 0, 0.004), 0)  # mount plate
    body.cyl(0.009, 0.20, (0.20, 0.06, 0.045), 1, axis="X", segments=16)  # supply line in
    body.cyl(0.009, 0.08, (0.065, 0.06, 0.045), 1, axis="X", segments=16)  # valve -> regulator
    body.cyl(0.009, 0.10, (-0.075, 0.06, 0.045), 1, axis="X", segments=16)  # regulator out
    body.cyl(0.009, 0.045, (-0.12, 0.06, 0.0225), 1, segments=16)  # into the panel
    body.box((0.055, 0.065, 0.05), (0, 0.06, 0.045), 1)  # regulator body
    body.cyl(0.016, 0.024, (0, 0.105, 0.045), 2, axis="Y", segments=24)  # set-point knob
    body.cyl(0.021, 0.07, (0, -0.010, 0.045), 3, axis="Y", segments=24)  # filter bowl
    body.cyl(0.010, 0.012, (0, 0.06, 0.076), 1, segments=16)  # gauge stem
    body.text("AIR SUPPLY  6 BAR", 0.011, (0, 0.128, 0.0081), 4)
    body.build("AirRegulator", [M["plate"], M["alu"], M["rubber"], M["bowl"], M["label_light"]], air)

    # Gauge, facing the operator. Needle rest pose points straight up (5 bar);
    # the app turns it to 135 deg - 27 deg/bar.
    g = Vector((0, 0.06, 0.082))
    gauge = Geo()
    gauge.cyl(0.033, 0.012, (0, 0, 0.006), 0, segments=40)
    gauge.cyl(0.029, 0.001, (0, 0, 0.0125), 1, segments=40)
    for i in range(11):
        a = math.radians(135 - 27 * i)
        r = 0.024
        gauge.box(
            (0.0012, 0.005 if i % 2 == 0 else 0.003, 0.0004),
            (-r * math.sin(a), r * math.cos(a), 0.0132),
            2,
            rot_z=a,
        )
        if i % 2 == 0:
            rr = 0.0165
            gauge.text(str(i), 0.0045, (-rr * math.sin(a), rr * math.cos(a), 0.0132), 2)
    gauge.text("bar", 0.004, (0, -0.012, 0.0132), 2)
    gauge.build("AirGauge", [M["steel"], M["gauge_face"], M["key_label"]], air, g)
    needle = Geo()
    needle.box((0.0018, 0.026, 0.0008), (0, 0.010, 0.0004), 0)
    needle.cyl(0.003, 0.0016, (0, 0, 0.0008), 1, segments=12)
    needle.build("AirGauge_Needle", [M["red"], M["casting"]], air, g + Vector((0, 0, 0.0136)))
    anchor("air_gauge", air, g + Vector((0, 0, 0.02)), 0.7)

    # Ball valve. Lever along the pipe = open, across it = closed (rest pose).
    valve = frame("AirValve", (0, 0, 0), (1, 0, 0), (0, 1, 0), air)
    valve["part"] = "air_valve"
    vb = Geo()
    vb.cyl(0.018, 0.05, (0.13, 0.06, 0.045), 0, axis="X", segments=6, smooth=False)
    vb.cyl(0.006, 0.02, (0.13, 0.06, 0.07), 0, segments=12)
    vb.build("AirValve_Body", [M["alu"]], valve)
    lever = Geo()
    lever.box((0.085, 0.014, 0.006), (0.036, 0, 0.003), 0)
    lever.cyl(0.009, 0.008, (0, 0, 0.004), 0, segments=16)
    lever_ob = lever.build("AirValve_Lever", [M["valve_lever"]], valve, (0.13, 0.06, 0.08))
    lever_ob.rotation_euler = (0, 0, -math.pi / 2)
    anchor("air_valve", valve, (0.13, 0.03, 0.1))


def build_vise(axis_c, M):
    """Riser and self-centring 5-axis vise on the platter, with the empty the
    app hangs the stock from. Tall on purpose: on B = -90 the side faces of
    the part have to clear the platter and the head."""
    vise = Geo()
    vise.cyl(0.055, VISE_RISER, (0, 0, VISE_RISER / 2), 0, segments=40)
    vise.box((0.14, 0.07, VISE_TOP - VISE_RISER), (0, 0, (VISE_TOP + VISE_RISER) / 2), 0)
    # Lead screw ends, so the jaw travel reads.
    vise.cyl(0.008, 0.15, (0, 0, VISE_TOP - 0.012), 1, axis="X", segments=16)
    body = vise.build("Vise", [M["vise"], M["steel"]], axis_c)
    body["part"] = "vise"
    # Jaws grip the bottom JAW_GRIP of the stock. Rest pose: closed on the
    # default 80 mm stock; the app moves them along X to the stock's width.
    for name, side in (("Vise_JawNeg", -1), ("Vise_JawPos", 1)):
        jaw = Geo()
        jaw.box((0.025, 0.07, 0.016), (side * 0.0125, 0, JAW_GRIP - 0.008), 0)
        ob = jaw.build(name, [M["steel"]], axis_c, (side * 0.040, 0, VISE_TOP))
        ob["part"] = "vise"
    empty("Stock_Mount", axis_c, (0, 0, VISE_TOP), size=0.02)
    # Seen from in front of the door, over the platter, not from the roof.
    anchor("vise", axis_c, (0, -0.06, VISE_TOP + 0.03), tilt_x=63.4, frontal=True)


def build_main_switch(root, M):
    """Rotary main disconnect on the electrical cabinet door."""
    sw = frame("MainSwitch", MAIN_SWITCH, (0, 1, 0), (0, 0, 1), root)
    sw["part"] = "main_switch"
    plate = Geo()
    plate.box((0.11, 0.11, 0.004), (0, 0, 0.002), 0)
    plate.text("0", 0.012, (-0.047, 0, 0.0042), 1)
    plate.text("I", 0.012, (0, 0.044, 0.0042), 1)
    plate.text("MAIN DISCONNECT", 0.0075, (0, -0.067, 0.0042), 1)
    plate.build("MainSwitch_Plate", [M["yellow"], M["key_label"]], sw)
    handle = Geo()
    handle.cyl(0.020, 0.016, (0, 0, 0.008), 0, segments=32)
    handle.box((0.078, 0.020, 0.016), (0, 0, 0.020), 0)
    handle.box((0.010, 0.022, 0.004), (-0.032, 0, 0.0285), 1)
    # Rest pose is OFF: grip horizontal, white pointer on "0". ON is a quarter
    # turn clockwise, which brings the pointer up to "I".
    handle.build("MainSwitch_Handle", [M["valve_lever"], M["label_light"]], sw, (0, 0, 0.004))
    anchor("main_switch", sw, (0, 0, 0.05))


# --- export and preview --------------------------------------------------------


def export(root):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_extras=True,
        export_yup=True,
        # Draco: the solid model's detail at a fifth of the size. The app
        # decodes it with three's decoder, served from public/draco/.
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    tris = sum(
        sum(len(p.vertices) - 2 for p in o.data.polygons)
        for o in bpy.data.objects
        if o.type == "MESH"
    )
    nodes = len(bpy.data.objects)
    print(f"exported {OUT} ({OUT.stat().st_size / 1e6:.2f} MB, {nodes} nodes, ~{tris} tris)")


def preview(root, out_dir):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = 1100, 850
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    COLL.objects.link(cam)
    sc.camera = cam
    bpy.context.view_layer.update()
    offset = root.matrix_world.translation

    def shot(name, eye, target, lens=35):
        cam_data.lens = lens
        cam.location = Vector(eye) + offset
        cam.rotation_euler = (Vector(target) + offset - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = str(Path(out_dir) / f"{name}.png")
        bpy.ops.render.render(write_still=True)

    shot("front34", (3.4, -4.6, 2.4), (0, -0.4, 1.2))
    shot("pendant", (0.55, -1.95, 1.48), (0.5, -1.32, 1.45), 50)
    shot("rear_air", (0.15, 2.0, 1.35), (0.4, 1.15, 1.15), 45)
    shot("main_switch", (1.9, 0.75, 1.5), (1.04, 0.7, 1.35), 45)

    # Pose test: door open, head jogged, trunnion tilted, controls actuated.
    o = bpy.data.objects
    o["Door"].location.x -= 0.68
    o["Axis_X"].location.x -= 0.25
    o["Axis_Y"].location.y -= 0.2
    o["Axis_Z"].location.z += 0.15
    o["Axis_B"].rotation_euler.y = math.radians(-60)
    o["Axis_C"].rotation_euler.z = math.radians(30)
    o["AirValve_Lever"].rotation_euler.z = 0
    o["MainSwitch_Handle"].rotation_euler.z = -math.pi / 2
    shot("pose_front", (2.2, -3.6, 1.9), (-0.1, -0.5, 1.15))
    shot("pose_side", (-0.2, -3.2, 1.4), (0, -0.5, 1.0), 45)

    # The trunnion split, with the shell out of the way.
    for name in ("Enclosure", "Door", "DoorPanel", "SideWindow", "Pendant"):
        o[name].hide_render = True
    for ob in o["Pendant"].children_recursive:
        ob.hide_render = True
    shot("trunnion_tilt_neg", (0.2, -2.4, 1.3), (0, -0.5, 0.85), 45)
    o["Axis_B"].rotation_euler.y = math.radians(30)
    shot("trunnion_tilt_pos", (0.2, -2.4, 1.3), (0, -0.5, 0.85), 45)

    # Tool change: head at the change position (X-610 Y-82 Z0), the station
    # pocket down, the arm on both tools; then dropped and half way round.
    o["Axis_X"].location.x = (-610 + 53) / 1000
    o["Axis_Y"].location.y = -0.082
    o["Axis_Z"].location.z = 0.259
    o["Axis_B"].rotation_euler.y = 0
    o["Pocket_01"].rotation_euler.y = -math.pi / 2
    o["ToolChanger_Arm"].rotation_euler.z = -math.pi / 2
    shot("toolchange_grip", (-0.05, -1.75, 1.75), (-0.62, -0.41, 1.36), 40)
    shot("toolchange_grip_top", (-0.61, -0.41, 3.2), (-0.61, -0.41, 1.3), 40)
    o["ToolChanger_Arm"].location.z -= 0.12
    o["ToolChanger_Arm"].rotation_euler.z = -math.pi
    shot("toolchange_swing", (-0.05, -1.75, 1.75), (-0.62, -0.41, 1.36), 40)
    o["Pocket_01"].rotation_euler.y = 0
    o["ToolChanger_Arm"].location.z += 0.12
    o["ToolChanger_Arm"].rotation_euler.z = 0
    o["ToolChanger_Carousel"].rotation_euler.x = math.radians(-36)
    shot("toolchange_carousel", (-2.2, -0.9, 1.9), (-0.9, -0.41, 1.7), 40)


if __name__ == "__main__":
    model = build()
    export(model)
    if PREVIEW_DIR:
        preview(model, PREVIEW_DIR)
