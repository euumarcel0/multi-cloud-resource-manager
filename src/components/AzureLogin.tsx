
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cloud, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface AzureLoginProps {
  onLoginSuccess: () => void;
}

const AzureLogin = ({ onLoginSuccess }: AzureLoginProps) => {
  const { toast } = useToast();
  const { loginAzure } = useAuth();
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    subscriptionId: "",
    clientId: "",
    clientSecret: "",
    tenantId: "",
    location: "East US"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subscriptionId || !formData.clientId || !formData.clientSecret || !formData.tenantId) {
      toast({
        title: "Erro de Validação",
        description: "Todos os campos são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      await loginAzure(formData);
      toast({
        title: "Login Azure Realizado",
        description: "Servidor backend iniciado e Terraform inicializado com sucesso!",
      });
      onLoginSuccess();
    } catch (error) {
      console.error('Erro no login Azure:', error);
      toast({
        title: "Erro no Login",
        description: error instanceof Error ? error.message : "Falha ao fazer login no Azure",
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
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span>Login Azure</span>
          </CardTitle>
          <CardDescription>
            Insira suas credenciais do Azure para continuar. O servidor backend será iniciado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="subscriptionId">Subscription ID *</Label>
              <Input
                id="subscriptionId"
                type="text"
                value={formData.subscriptionId}
                onChange={(e) => setFormData({ ...formData, subscriptionId: e.target.value })}
                placeholder="12345678-1234-1234-1234-123456789012"
                required
              />
            </div>

            <div>
              <Label htmlFor="clientId">Client ID *</Label>
              <Input
                id="clientId"
                type="text"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="12345678-1234-1234-1234-123456789012"
                required
              />
            </div>

            <div>
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showClientSecret ? "text" : "password"}
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  placeholder="Client Secret do Service Principal"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                >
                  {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="tenantId">Tenant ID *</Label>
              <Input
                id="tenantId"
                type="text"
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                placeholder="12345678-1234-1234-1234-123456789012"
                required
              />
            </div>

            <div>
              <Label htmlFor="location">Localização Padrão</Label>
              <Input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="East US"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando servidor e fazendo login...
                </>
              ) : (
                'Fazer Login no Azure'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Como criar um Service Principal Azure:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>1. Acesse o Portal Azure</li>
              <li>2. Vá em Azure Active Directory → App registrations</li>
              <li>3. Crie uma nova aplicação</li>
              <li>4. Gere um client secret</li>
              <li>5. Atribua as permissões necessárias</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AzureLogin;
