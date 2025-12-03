import { redirect } from "next/navigation";

/**
 * Landing page - redirects to dashboard
 */
export default function Home() {
  redirect("/dashboard");
}
