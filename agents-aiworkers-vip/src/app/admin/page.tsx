import { redirect } from "next/navigation";

import { PLATFORM_MARKETPLACE_PATH } from "@/lib/constants";

export default function AdminIndexPage() {
  redirect(PLATFORM_MARKETPLACE_PATH);
}
