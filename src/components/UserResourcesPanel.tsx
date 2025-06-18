
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Database } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface CreatedResource {
  id: string;
  type: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
}

const UserResourcesPanel = () => {
  const { toast } = useToast();
  const { awsAuth } = useAuth();
  const [resources, setResources] = useState<CreatedResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "ID copiado para a área de transferência",
    });
  };

  const loadResources = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      console.log('UserResourcesPanel: Usuário não autenticado ou credenciais incompletas');
      return;
    }
    
    setIsLoading(true);
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;
      
      console.log('UserResourcesPanel: Carregando recursos para userId:', userId);
      
      const response = await fetch(`${backendUrl}/api/aws/resources/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('UserResourcesPanel: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('UserResourcesPanel: Recursos recebidos:', data);
        setResources(data.resources || []);
      } else {
        console.error('UserResourcesPanel: Erro na resposta:', response.status, response.statusText);
      }
    } catch (error) {
      console.error("UserResourcesPanel: Erro ao carregar recursos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('UserResourcesPanel: useEffect executado, isAuthenticated:', awsAuth.isAuthenticated);
    loadResources();
    
    // Auto-refresh resources every 30 seconds
    const interval = setInterval(loadResources, 30000);
    return () => clearInterval(interval);
  }, [awsAuth.isAuthenticated]);

  const getResourceIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'vpc': '🌐',
      'subnet': '🔗',
      'ec2': '💻',
      'security-group': '🛡️',
      'load-balancer': '⚖️',
      'internet-gateway': '🌍'
    };
    return icons[type] || '📦';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
      case 'running':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Recursos Criados</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadResources}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardTitle>
        <CardDescription>
          IDs dos recursos AWS criados para reutilização
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 w-full">
          {resources.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum recurso criado ainda</p>
              <p className="text-sm">Os recursos aparecerão aqui após o deployment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getResourceIcon(resource.type)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-sm">{resource.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {resource.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{resource.id}</p>
                      <p className="text-xs text-gray-400">{resource.createdAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(resource.status)}>
                      {resource.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(resource.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default UserResourcesPanel;
