
import AppLayout from "../../components/layout/AppLayout";

export default function RoutineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
