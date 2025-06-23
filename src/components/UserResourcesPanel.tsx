
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Database, Eye, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface CreatedResource {
  id: string;
  type: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
  details?: {
    arn?: string;
    vpc_id?: string;
    subnet_id?: string;
    security_group_id?: string;
    availability_zone?: string;
    cidr_block?: string;
    instance_type?: string;
    public_ip?: string;
    private_ip?: string;
    dns_name?: string;
    [key: string]: any;
  };
}

const UserResourcesPanel = () => {
  const { toast } = useToast();
  const { awsAuth } = useAuth();
  const [resources, setResources] = useState<CreatedResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResource, setSelectedResource] = useState<CreatedResource | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "ID copiado para a área de transferência",
    });
  };

  const checkResourceStatus = async (resourceId: string, resourceType: string) => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      return 'unknown';
    }
    
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;
      
      const response = await fetch(`${backendUrl}/api/aws/resource-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          resourceId,
          resourceType,
          region: awsAuth.credentials.region || 'us-east-1'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.status || 'unknown';
      }
    } catch (error) {
      console.error('Erro ao verificar status do recurso:', error);
    }
    
    return 'unknown';
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
        const resourcesWithStatus = data.resources || [];
        
        // Verificar status real de cada recurso
        for (let resource of resourcesWithStatus) {
          const realStatus = await checkResourceStatus(resource.id, resource.type);
          resource.status = realStatus;
        }
        
        setResources(resourcesWithStatus);
      } else {
        console.error('UserResourcesPanel: Erro na resposta:', response.status, response.statusText);
      }
    } catch (error) {
      console.error("UserResourcesPanel: Erro ao carregar recursos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadResourceDetails = async (resource: CreatedResource) => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      return;
    }
    
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;
      
      const response = await fetch(`${backendUrl}/api/aws/resource-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          resourceId: resource.id,
          resourceType: resource.type,
          region: awsAuth.credentials.region || 'us-east-1'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedResource({
          ...resource,
          details: data.details || {}
        });
      } else {
        setSelectedResource(resource);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do recurso:', error);
      setSelectedResource(resource);
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
      case 'deploying':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
      case 'error':
      case 'terminated':
        return 'bg-red-100 text-red-700';
      case 'stopping':
      case 'shutting-down':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const openAWSConsole = (resource: CreatedResource) => {
    const region = resource.region || 'us-east-1';
    let consoleUrl = '';
    
    switch (resource.type) {
      case 'vpc':
        consoleUrl = `https://${region}.console.aws.amazon.com/vpc/home?region=${region}#vpcs:VpcId=${resource.id}`;
        break;
      case 'subnet':
        consoleUrl = `https://${region}.console.aws.amazon.com/vpc/home?region=${region}#subnets:SubnetId=${resource.id}`;
        break;
      case 'ec2':
        consoleUrl = `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#InstanceDetails:instanceId=${resource.id}`;
        break;
      case 'security-group':
        consoleUrl = `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#SecurityGroup:groupId=${resource.id}`;
        break;
      case 'load-balancer':
        consoleUrl = `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#LoadBalancer:loadBalancerArn=${resource.id}`;
        break;
      case 'internet-gateway':
        consoleUrl = `https://${region}.console.aws.amazon.com/vpc/home?region=${region}#igws:InternetGatewayId=${resource.id}`;
        break;
      default:
        consoleUrl = `https://${region}.console.aws.amazon.com/console/home?region=${region}`;
    }
    
    window.open(consoleUrl, '_blank');
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
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadResourceDetails(resource)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Detalhes do Recurso</DialogTitle>
                          <DialogDescription>
                            Informações detalhadas sobre {selectedResource?.name}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedResource && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-500">ID</label>
                                <p className="font-mono text-sm">{selectedResource.id}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Tipo</label>
                                <p className="text-sm">{selectedResource.type}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Status</label>
                                <Badge className={getStatusColor(selectedResource.status)}>
                                  {selectedResource.status}
                                </Badge>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Região</label>
                                <p className="text-sm">{selectedResource.region}</p>
                              </div>
                            </div>
                            
                            {selectedResource.details && Object.keys(selectedResource.details).length > 0 && (
                              <div>
                                <label className="text-sm font-medium text-gray-500 mb-2 block">Detalhes Técnicos</label>
                                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                  {Object.entries(selectedResource.details).map(([key, value]) => (
                                    <div key={key} className="flex justify-between items-center">
                                      <span className="text-sm font-medium text-gray-600 capitalize">
                                        {key.replace(/_/g, ' ')}:
                                      </span>
                                      <span className="text-sm font-mono text-gray-900">
                                        {typeof value === 'string' ? value : JSON.stringify(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-between pt-4">
                              <Button
                                variant="outline"
                                onClick={() => copyToClipboard(selectedResource.id)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar ID
                              </Button>
                              <Button
                                onClick={() => openAWSConsole(selectedResource)}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver no AWS Console
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
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
