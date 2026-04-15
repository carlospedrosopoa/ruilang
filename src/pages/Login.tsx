import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from = typeof location?.state?.from === "string" ? location.state.from : "/";

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (!password) {
      toast.error("Informe sua senha.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });
      if (error) throw error;
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="font-display text-xl">Entrar</CardTitle>
              <p className="text-xs text-muted-foreground">Acesse sua conta</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-mail</Label>
            <Input
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="seuemail@exemplo.com"
              type="email"
              autoComplete="email"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="Sua senha"
              type="password"
              autoComplete="current-password"
              className="mt-1.5"
              onKeyDown={(ev) => {
                if (ev.key === "Enter") handleLogin();
              }}
            />
          </div>
          <Button onClick={handleLogin} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Entrar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

