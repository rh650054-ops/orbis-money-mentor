import { Component, ReactNode } from "react";
import { Button } from "@/shared/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[Vant] App render failure:", error);
  }

  private recover = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center px-6">
        <section className="w-full max-w-sm text-center space-y-5">
          <img src="/vant-logo.png" alt="Vant" className="w-16 h-16 mx-auto object-contain opacity-90" />
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight">A Vant deu uma travada.</h1>
            <p className="text-sm text-muted-foreground">
              Atualize o app para carregar a versão mais recente.
            </p>
          </div>
          <Button onClick={this.recover} className="w-full h-12 font-bold">
            Recarregar Vant
          </Button>
        </section>
      </main>
    );
  }
}