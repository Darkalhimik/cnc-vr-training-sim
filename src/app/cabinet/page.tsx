import { redirect } from "next/navigation";

/** The cabinet became the warehouse; old links and bookmarks land there. */
export default function CabinetRedirect() {
  redirect("/warehouse");
}
