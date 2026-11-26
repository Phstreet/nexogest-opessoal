import AuthForm from "@/components/auth/AuthForm";

export default function EntrarPage() {
  const signupEnabled = process.env.NEXO_SIGNUP_ENABLED === "true";
  return <AuthForm mode="login" signupEnabled={signupEnabled} />;
}
