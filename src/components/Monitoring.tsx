
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Server, 
  Shield, 
  Network, 
  HardDrive, 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  Eye
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface Resource {
  id: string;
  type: string;
  name: string;
  status: string;
  provider: string;
  region: string;
  createdAt: string;
  lastChecked: string;
  metrics?: {
    cpu?: number;
    memory?: number;
    network?: number;
    storage?: number;
  };
  details?: Record<string, any>;
}

const Monitoring = () => {
  const { toast } = useToast();
  const { awsAuth, isServerRunning } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const fetchResources = async () => {
    if (!isServerRunning || !awsAuth.isAuthenticated) return;
    
    setIsLoading(true);
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : '';
      
      const response = await fetch(`${backendUrl}/api/resources/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setResources(data.resources || []);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast({
        title: "Erro ao carregar recursos",
        description: "Não foi possível carregar os recursos para monitoramento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteResource = async (resourceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este recurso? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : '';
      
      const response = await fetch(`${backendUrl}/api/resources/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId }),
      });

      if (response.ok) {
        toast({
          title: "Recurso excluído",
          description: "O recurso foi excluído com sucesso.",
        });
        fetchResources(); // Refresh the list
      } else {
        throw new Error('Falha ao excluir recurso');
      }
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast({
        title: "Erro ao excluir recurso",
        description: "Não foi possível excluir o recurso.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchResources();
    
    // Set up real-time updates every 60 seconds
    const interval = setInterval(fetchResources, 60000);
    return () => clearInterval(interval);
  }, [isServerRunning, awsAuth.isAuthenticated]);

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'ec2':
      case 'instance':
        return <Server className="h-5 w-5" />;
      case 'vpc':
      case 'network':
        return <Network className="h-5 w-5" />;
      case 'security-group':
      case 'securitygroup':
        return <Shield className="h-5 w-5" />;
      case 'volume':
      case 'storage':
        return <HardDrive className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'available':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'stopped':
      case 'stopping':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      case 'starting':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'available':
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'stopped':
      case 'stopping':
        return 'bg-red-100 text-red-700';
      case 'pending':
      case 'starting':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (!awsAuth.isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Monitoramento</h2>
            <p className="text-gray-600 mt-1">Monitor todos os seus recursos na nuvem</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900">Autenticação Necessária</h3>
              <p className="text-gray-600 max-w-md">
                Você precisa fazer login para acessar o monitoramento dos recursos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Monitoramento</h2>
          <p className="text-gray-600 mt-1">Monitor todos os seus recursos na nuvem</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchResources}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <span className="text-sm text-gray-500">
            Atualizado: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Resource Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{resources.length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {resources.filter(r => ['running', 'available', 'active'].includes(r.status.toLowerCase())).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Stopped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {resources.filter(r => ['stopped', 'stopping'].includes(r.status.toLowerCase())).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {resources.filter(r => ['pending', 'starting'].includes(r.status.toLowerCase())).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resources List */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Recursos Criados</CardTitle>
          <CardDescription>
            Lista completa de todos os recursos criados e seu status atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resources.length === 0 ? (
              <div className="text-center py-8">
                <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum recurso encontrado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Crie recursos na seção AWS Deployment para vê-los aqui
                </p>
              </div>
            ) : (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white">
                      {getResourceIcon(resource.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{resource.name}</h3>
                      <p className="text-sm text-gray-500">
                        {resource.type} • {resource.id} • {resource.region}
                      </p>
                      <p className="text-xs text-gray-400">
                        Criado em {new Date(resource.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {/* Metrics */}
                    {resource.metrics && (
                      <div className="text-right space-y-1">
                        {resource.metrics.cpu && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">CPU:</span>
                            <Progress value={resource.metrics.cpu} className="w-16 h-1" />
                            <span className="text-xs text-gray-600">{resource.metrics.cpu}%</span>
                          </div>
                        )}
                        {resource.metrics.memory && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">MEM:</span>
                            <Progress value={resource.metrics.memory} className="w-16 h-1" />
                            <span className="text-xs text-gray-600">{resource.metrics.memory}%</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Status */}
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusIcon(resource.status)}
                        <Badge className={getStatusColor(resource.status)}>
                          {resource.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        Checked: {new Date(resource.lastChecked).toLocaleTimeString()}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedResource(resource)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteResource(resource.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resource Details Modal */}
      {selectedResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Detalhes do Recurso</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedResource(null)}>
                  ✕
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nome</label>
                  <p className="text-sm text-gray-900">{selectedResource.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Tipo</label>
                  <p className="text-sm text-gray-900">{selectedResource.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">ID</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedResource.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <Badge className={getStatusColor(selectedResource.status)}>
                    {selectedResource.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Provider</label>
                  <p className="text-sm text-gray-900">{selectedResource.provider.toUpperCase()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Região</label>
                  <p className="text-sm text-gray-900">{selectedResource.region}</p>
                </div>
              </div>
              
              {selectedResource.details && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Detalhes Técnicos</label>
                  <pre className="text-xs bg-gray-100 p-3 rounded-lg mt-2 overflow-x-auto">
                    {JSON.stringify(selectedResource.details, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Monitoring;
