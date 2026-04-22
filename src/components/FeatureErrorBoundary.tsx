import { Component, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
}

export default class FeatureErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("FeatureErrorBoundary:", error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="card-gradient-border bg-card">
          <CardContent className="pt-6 space-y-3">
            <div>
              <p className="font-semibold text-foreground">
                {this.props.title || "Esse bloco não carregou agora"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                O restante da tela continua funcionando. Tente recarregar esse bloco.
              </p>
            </div>
            <Button onClick={this.handleRetry} variant="outline" size="sm">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}