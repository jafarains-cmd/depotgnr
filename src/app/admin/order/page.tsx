import { redirect } from "next/navigation";

export default function OrderAdminRedirect() {
  // Admin & kasir share UI yang sama untuk order management
  redirect("/kasir/order");
}
