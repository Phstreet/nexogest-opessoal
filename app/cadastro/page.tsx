import AuthForm from "@/components/auth/AuthForm";

export default function CadastroPage() {
  const signupEnabled = process.env.NEXO_SIGNUP_ENABLED === "true";
  return <AuthForm mode="signup" signupEnabled={signupEnabled} />;
}
