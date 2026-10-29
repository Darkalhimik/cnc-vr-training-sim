"""
Tessellates a STEP assembly into a GLB, keeping its structure, part names and
colours, and writes an inventory of every part beside it.

This is the first half of the model pipeline: Haas publishes UMC-500 solid
models (STEP) on the machine's page; Blender cannot read STEP, so OpenCascade
meshes it here and tools/blender/build_umc500.py takes the GLB from there.

    tools/cad/.venv/Scripts/python tools/cad/step_to_glb.py \
        --step "assets/cad/haas-pp10/UMC-500 w 10 Station PP_3_2026.STEP" \
        --out  assets/cad/haas-pp10/umc500-solid.glb

`--lin` is the chordal deflection in millimetres and `--ang` the angular one
in radians: how far a triangle may stray from the true surface. The defaults
keep a 100 mm bore round to the eye at arm's length without tessellating
castings into millions of triangles.

Setup: python -m venv tools/cad/.venv
       tools/cad/.venv/Scripts/python -m pip install cadquery-ocp
"""

import argparse
import json
import sys
import time

from OCP.BRep import BRep_Tool
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.Bnd import Bnd_Box
from OCP.IFSelect import IFSelect_RetDone
from OCP.Message import Message_ProgressRange
from OCP.Quantity import Quantity_Color
from OCP.RWGltf import RWGltf_CafWriter, RWGltf_WriterTrsfFormat
from OCP.RWMesh import RWMesh_CoordinateSystem
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_AsciiString, TCollection_ExtendedString
from OCP.TDF import TDF_Label
from OCP.collections import Sequence_TDF_Label as TDF_LabelSequence
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.XCAFApp import XCAFApp_Application
from OCP.XCAFDoc import XCAFDoc_ColorTool, XCAFDoc_ColorType, XCAFDoc_DocumentTool
from OCP.collections import IndexedDataMap_TCollection_AsciiString_TCollection_AsciiString as FileInfo


def label_name(label):
    attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), attr):
        return attr.Get().ToExtString()
    return ""


def triangles(shape):
    count = 0
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(TopoDS.Face(explorer.Current()), loc)
        if tri is not None:
            count += tri.NbTriangles()
        explorer.Next()
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lin", type=float, default=0.35, help="linear deflection, mm")
    ap.add_argument("--ang", type=float, default=0.3, help="angular deflection, rad")
    args = ap.parse_args()

    t0 = time.time()
    app = XCAFApp_Application.GetApplication_s()
    doc = TDocStd_Document(TCollection_ExtendedString("MDTV-XCAF"))
    app.InitDocument(doc)

    reader = STEPCAFControl_Reader()
    reader.SetColorMode(True)
    reader.SetNameMode(True)
    reader.SetLayerMode(True)
    if reader.ReadFile(args.step) != IFSelect_RetDone:
        sys.exit(f"could not read {args.step}")
    reader.Transfer(doc)
    print(f"read in {time.time() - t0:.1f} s", flush=True)

    shapes = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    colors = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    roots = TDF_LabelSequence()
    shapes.GetFreeShapes(roots)

    t1 = time.time()
    for i in range(1, roots.Length() + 1):
        shape = shapes.GetShape_s(roots.Value(i))
        BRepMesh_IncrementalMesh(shape, args.lin, False, args.ang, True)
    print(f"meshed in {time.time() - t1:.1f} s", flush=True)

    # Inventory: every component of every assembly, with its path, the part it
    # instances, its colour, its size and its triangles.
    inventory = []

    def color_of(label):
        """The label's own colour, else its shape's, as linear-ish 0..1 RGB."""
        c = Quantity_Color()
        holder = TDF_Label()
        kinds = (XCAFDoc_ColorType.XCAFDoc_ColorSurf, XCAFDoc_ColorType.XCAFDoc_ColorGen)
        for kind in kinds:
            if XCAFDoc_ColorTool.GetColor_s(label, kind, holder) and XCAFDoc_ColorTool.GetColor_s(holder, c):
                return [round(c.Red(), 3), round(c.Green(), 3), round(c.Blue(), 3)]
        shape = shapes.GetShape_s(label)
        for kind in kinds:
            if colors.GetColor(shape, kind, c):
                return [round(c.Red(), 3), round(c.Green(), 3), round(c.Blue(), 3)]
        return None

    def walk(label, path, depth):
        name = label_name(label)
        here = f"{path}/{name}" if path else name
        ref = TDF_Label()
        target = label
        if shapes.IsReference_s(label) and shapes.GetReferredShape_s(label, ref):
            target = ref
        shape = shapes.GetShape_s(label)
        box = Bnd_Box()
        BRepBndLib.Add_s(shape, box)
        size = None
        if not box.IsVoid():
            lo, hi = box.CornerMin(), box.CornerMax()
            x0, y0, z0, x1, y1, z1 = lo.X(), lo.Y(), lo.Z(), hi.X(), hi.Y(), hi.Z()
            size = {"min": [round(x0, 1), round(y0, 1), round(z0, 1)], "max": [round(x1, 1), round(y1, 1), round(z1, 1)]}
        children = TDF_LabelSequence()
        is_assembly = shapes.IsAssembly_s(target)
        if is_assembly:
            shapes.GetComponents_s(target, children, False)
        inventory.append(
            {
                "path": here,
                "part": label_name(target),
                "depth": depth,
                "assembly": is_assembly,
                "color": color_of(label) or color_of(target),
                "box": size,
                "triangles": None if is_assembly else triangles(shape),
            }
        )
        for k in range(1, children.Length() + 1):
            walk(children.Value(k), here, depth + 1)

    for i in range(1, roots.Length() + 1):
        walk(roots.Value(i), "", 0)

    total = sum(p["triangles"] or 0 for p in inventory)
    with open(args.out.rsplit(".", 1)[0] + ".inventory.json", "w", encoding="utf-8") as f:
        json.dump({"step": args.step, "lin": args.lin, "ang": args.ang, "triangles": total, "parts": inventory}, f, indent=1)
    print(f"{len(inventory)} components, {total} triangles", flush=True)

    # glTF is Y-up in metres; the STEP is millimetres. Which way is up in the
    # STEP is checked in Blender, not assumed here.
    writer = RWGltf_CafWriter(TCollection_AsciiString(args.out), True)
    writer.SetTransformationFormat(RWGltf_WriterTrsfFormat.RWGltf_WriterTrsfFormat_Compact)
    converter = writer.ChangeCoordinateSystemConverter()
    converter.SetInputLengthUnit(0.001)
    converter.SetInputCoordinateSystem(RWMesh_CoordinateSystem.RWMesh_CoordinateSystem_Zup)
    t2 = time.time()
    if not writer.Perform(doc, FileInfo(), Message_ProgressRange()):
        sys.exit("glTF export failed")
    print(f"wrote {args.out} in {time.time() - t2:.1f} s; total {time.time() - t0:.1f} s", flush=True)


if __name__ == "__main__":
    main()
