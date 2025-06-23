
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Cloud, Server, Shield, Database, Activity, CheckCircle, XCircle, Clock, Eye, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface Deployment {
  id: string;
  name: string;
  provider: string;
  status: string;
  resources: number;
  lastUpdate: string;
  progress: number;
  region?: string;
  details?: any;
}

const Dashboard = () => {
  const { awsAuth } = useAuth();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadRealDeployments = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      // Mostrar dados mockados se não estiver autenticado
      setDeployments([
        {
          id: "1",
          name: "AWS Production Environment",
          provider: "aws",
          status: "running",
          resources: 12,
          lastUpdate: "2 hours ago",
          progress: 100
        },
        {
          id: "2",
          name: "Azure Development Environment", 
          provider: "azure",
          status: "deploying",
          resources: 8,
          lastUpdate: "5 minutes ago",
          progress: 75
        },
        {
          id: "3",
          name: "AWS Load Balancer Setup",
          provider: "aws", 
          status: "failed",
          resources: 5,
          lastUpdate: "1 day ago",
          progress: 60
        }
      ]);
      return;
    }
    
    setIsLoading(true);
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;
      
      const response = await fetch(`${backendUrl}/api/aws/resources/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const resources = data.resources || [];
        
        // Agrupar recursos por tipo para criar "deployments"
        const groupedDeployments = groupResourcesIntoDeployments(resources);
        setDeployments(groupedDeployments);
      }
    } catch (error) {
      console.error("Erro ao carregar deployments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupResourcesIntoDeployments = (resources: any[]): Deployment[] => {
    const deploymentMap = new Map<string, Deployment>();
    
    resources.forEach(resource => {
      const deploymentKey = `${resource.type}-deployment`;
      
      if (!deploymentMap.has(deploymentKey)) {
        deploymentMap.set(deploymentKey, {
          id: deploymentKey,
          name: `AWS ${resource.type.toUpperCase()} Deployment`,
          provider: "aws",
          status: resource.status || "unknown",
          resources: 0,
          lastUpdate: new Date(resource.createdAt).toLocaleString(),
          progress: getProgressFromStatus(resource.status),
          region: resource.region,
          details: []
        });
      }
      
      const deployment = deploymentMap.get(deploymentKey)!;
      deployment.resources += 1;
      deployment.details = deployment.details || [];
      deployment.details.push(resource);
      
      // Atualizar status do deployment baseado no recurso mais recente
      if (new Date(resource.createdAt) > new Date(deployment.lastUpdate)) {
        deployment.lastUpdate = new Date(resource.createdAt).toLocaleString();
        deployment.status = resource.status;
        deployment.progress = getProgressFromStatus(resource.status);
      }
    });
    
    return Array.from(deploymentMap.values());
  };

  const getProgressFromStatus = (status: string): number => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'available':
        return 100;
      case 'deploying':
      case 'pending':
        return 75;
      case 'failed':
      case 'error':
        return 50;
      default:
        return 0;
    }
  };

  const loadDeploymentDetails = async (deployment: Deployment) => {
    setSelectedDeployment(deployment);
  };

  const openAWSConsole = (deployment: Deployment) => {
    const region = deployment.region || 'us-east-1';
    const consoleUrl = `https://${region}.console.aws.amazon.com/console/home?region=${region}`;
    window.open(consoleUrl, '_blank');
  };

  useEffect(() => {
    loadRealDeployments();
    
    // Auto-refresh deployments every 30 seconds
    const interval = setInterval(loadRealDeployments, 30000);
    return () => clearInterval(interval);
  }, [awsAuth.isAuthenticated]);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "available":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "deploying":
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "failed":
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'available':
        return 'bg-green-100 text-green-700';
      case 'deploying':
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getProviderColor = (provider: string) => {
    return provider === "aws" ? "from-orange-500 to-orange-600" : "from-blue-500 to-blue-600";
  };

  const totalResources = deployments.reduce((sum, d) => sum + d.resources, 0);
  const runningDeployments = deployments.filter(d => d.status === 'running' || d.status === 'available').length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <Activity className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deployments.length}</div>
            <p className="text-xs text-blue-100">{runningDeployments} running</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Server className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResources}</div>
            <p className="text-xs text-green-100">Running across clouds</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost This Month</CardTitle>
            <Database className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$247</div>
            <p className="text-xs text-purple-100">-12% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-orange-100">Excellent security posture</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deployments */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span>Recent Deployments</span>
          </CardTitle>
          <CardDescription>
            Monitor your infrastructure deployments across AWS and Azure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 bg-gradient-to-r ${getProviderColor(deployment.provider)} rounded-lg flex items-center justify-center`}>
                    {deployment.provider === "aws" ? (
                      <Server className="h-5 w-5 text-white" />
                    ) : (
                      <Cloud className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{deployment.name}</h3>
                    <p className="text-sm text-gray-500">
                      {deployment.resources} resources • {deployment.lastUpdate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(deployment.status)}
                      <Badge className={getStatusColor(deployment.status)}>
                        {deployment.status || 'unknown'}
                      </Badge>
                    </div>
                    {(deployment.status === "deploying" || deployment.status === "pending") && (
                      <Progress value={deployment.progress} className="w-20 mt-1" />
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadDeploymentDetails(deployment)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Deployment Details</DialogTitle>
                          <DialogDescription>
                            Detailed information about {selectedDeployment?.name}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedDeployment && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-500">Status</label>
                                <Badge className={getStatusColor(selectedDeployment.status)}>
                                  {selectedDeployment.status}
                                </Badge>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Provider</label>
                                <p className="text-sm">{selectedDeployment.provider.toUpperCase()}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Region</label>
                                <p className="text-sm">{selectedDeployment.region || 'us-east-1'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Resources</label>
                                <p className="text-sm">{selectedDeployment.resources}</p>
                              </div>
                            </div>
                            
                            {selectedDeployment.details && selectedDeployment.details.length > 0 && (
                              <div>
                                <label className="text-sm font-medium text-gray-500 mb-2 block">Resources</label>
                                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                  {selectedDeployment.details.map((resource: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center">
                                      <span className="text-sm font-medium text-gray-600">
                                        {resource.name} ({resource.type})
                                      </span>
                                      <span className="text-sm font-mono text-gray-900">
                                        {resource.id}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-between pt-4">
                              <Button
                                variant="outline"
                                onClick={() => loadRealDeployments()}
                              >
                                Refresh Data
                              </Button>
                              <Button
                                onClick={() => openAWSConsole(selectedDeployment)}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open AWS Console
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
