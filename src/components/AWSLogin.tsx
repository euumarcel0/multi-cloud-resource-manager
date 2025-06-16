
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Server, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface AWSLoginProps {
  onLoginSuccess: () => void;
}

const AWSLogin = ({ onLoginSuccess }: AWSLoginProps) => {
  const { toast } = useToast();
  const { loginAWS } = useAuth();
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    accessKey: "",
    secretKey: "",
    token: "",
    region: "us-east-1"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accessKey || !formData.secretKey) {
      toast({
        title: "Erro de Validação",
        description: "Access Key e Secret Key são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      await loginAWS(formData);
      toast({
        title: "Login AWS Realizado",
        description: "Servidor backend iniciado e Terraform inicializado com sucesso!",
      });
      onLoginSuccess();
    } catch (error) {
      console.error('Erro no login AWS:', error);
      toast({
        title: "Erro no Login",
        description: error instanceof Error ? error.message : "Falha ao fazer login na AWS",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span>Login AWS</span>
          </CardTitle>
          <CardDescription>
            Insira suas credenciais da AWS para continuar. O servidor backend será iniciado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="accessKey">Access Key *</Label>
              <Input
                id="accessKey"
                type="text"
                value={formData.accessKey}
                onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                required
              />
            </div>

            <div>
              <Label htmlFor="secretKey">Secret Key *</Label>
              <div className="relative">
                <Input
                  id="secretKey"
                  type={showSecretKey ? "text" : "password"}
                  value={formData.secretKey}
                  onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="token">Session Token (Opcional)</Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  placeholder="Token de sessão temporário"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="region">Região Padrão</Label>
              <Input
                id="region"
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="us-east-1"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando servidor e fazendo login...
                </>
              ) : (
                'Fazer Login na AWS'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Como obter suas credenciais AWS:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>1. Acesse o Console AWS</li>
              <li>2. Vá em IAM → Usuários → Seu usuário</li>
              <li>3. Aba "Credenciais de segurança"</li>
              <li>4. Crie uma chave de acesso</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AWSLogin;
