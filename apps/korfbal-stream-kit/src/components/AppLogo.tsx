
type AppLogoProps = {
  className?: string;
};

export default function AppLogo({ className = '' }: Readonly<AppLogoProps>) {
  return (
    <img
      src="/logo.png"
      alt="Korfbal Stream Kit Logo"
      className={className}
    />
  );
}
