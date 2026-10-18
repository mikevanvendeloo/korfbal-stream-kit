
type AppLogoProps = {
  className?: string;
};

export default function AppLogo({ className = '' }: Readonly<AppLogoProps>) {
  return (
    <img
      src="/logo.png"
      alt="Korfbal Streamz Kit Logo"
      className={className}
    />
  );
}
