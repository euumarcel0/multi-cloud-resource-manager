
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Server, Play, RotateCcw, Eye, EyeOff, AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface SelectedResources {
  vpc: boolean;
  publicSubnet: boolean;
  privateSubnet: boolean;
  securityGroup: boolean;
  ec2: boolean;
  loadBalancer: boolean;
  internetGateway: boolean;
}

interface SecurityGroupRule {
  type: 'ingress' | 'egress';
  fromPort: string;
  toPort: string;
  protocol: string;
  cidrBlocks: string;
  description: string;
}

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth, isServerRunning } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerraform, setShowTerraform] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string>("");
  const [hasExecuted, setHasExecuted] = useState(false);
  
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({
    vpc: false,
    publicSubnet: false,
    privateSubnet: false,
    securityGroup: false,
    ec2: false,
    loadBalancer: false,
    internetGateway: false
  });

  const [config, setConfig] = useState({
    region: (awsAuth.credentials && 'region' in awsAuth.credentials) ? awsAuth.credentials.region : "us-east-1",
    vpcName: "vpc-production",
    vpcCidr: "10.0.0.0/16",
    publicSubnetName: "public-subnet", 
    publicSubnetCidr: "10.0.1.0/24",
    privateSubnetName: "private-subnet",
    privateSubnetCidr: "10.0.2.0/24",
    existingVpcId: "",
    instanceType: "t2.micro",
    keyPair: "",
    sgName: "",
    sgDescription: "",
    existingSubnetId: "",
    existingSecurityGroupId: ""
  });

  const [securityGroupRules, setSecurityGroupRules] = useState<SecurityGroupRule[]>([
    {
      type: 'ingress',
      fromPort: '22',
      toPort: '22',
      protocol: 'tcp',
      cidrBlocks: '0.0.0.0/0',
      description: 'SSH access'
    },
    {
      type: 'ingress',
      fromPort: '80',
      toPort: '80',
      protocol: 'tcp',
      cidrBlocks: '0.0.0.0/0',
      description: 'HTTP access'
    }
  ]);

  const handleResourceChange = (resource: keyof SelectedResources, checked: boolean) => {
    setSelectedResources(prev => ({ ...prev, [resource]: checked }));
  };

  const addSecurityGroupRule = () => {
    setSecurityGroupRules([...securityGroupRules, {
      type: 'ingress',
      fromPort: '',
      toPort: '',
      protocol: 'tcp',
      cidrBlocks: '',
      description: ''
    }]);
  };

  const removeSecurityGroupRule = (index: number) => {
    setSecurityGroupRules(securityGroupRules.filter((_, i) => i !== index));
  };

  const updateSecurityGroupRule = (index: number, field: keyof SecurityGroupRule, value: string) => {
    const updatedRules = [...securityGroupRules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    setSecurityGroupRules(updatedRules);
  };

  const validateForm = () => {
    // Validar EC2
    if (selectedResources.ec2 && !config.keyPair.trim()) {
      toast({
        title: "Campo Obrigatório",
        description: "Key Pair é obrigatório para EC2 instances.",
        variant: "destructive"
      });
      return false;
    }

    // Validar Security Group
    if (selectedResources.securityGroup) {
      if (!config.sgName.trim() || !config.sgDescription.trim()) {
        toast({
          title: "Campos Obrigatórios",
          description: "Nome e descrição são obrigatórios para Security Group.",
          variant: "destructive"
        });
        return false;
      }

      for (let i = 0; i < securityGroupRules.length; i++) {
        const rule = securityGroupRules[i];
        if (!rule.fromPort || !rule.toPort || !rule.protocol || !rule.cidrBlocks || !rule.description) {
          toast({
            title: "Regra de Security Group Incompleta",
            description: `Regra ${i + 1}: Todos os campos são obrigatórios.`,
            variant: "destructive"
          });
          return false;
        }
      }
    }

    return true;
  };

  const handleDeploy = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa fazer login na AWS primeiro.",
        variant: "destructive"
      });
      return;
    }

    if (!isServerRunning) {
      toast({
        title: "Servidor não está rodando",
        description: "Faça login novamente para conectar ao servidor backend.",
        variant: "destructive"
      });
      return;
    }

    const selectedCount = Object.values(selectedResources).filter(Boolean).length;
    if (selectedCount === 0) {
      toast({
        title: "Nenhum Recurso Selecionado",
        description: "Selecione pelo menos um recurso para criar.",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsDeploying(true);
    setHasExecuted(true);
    setDeploymentLogs("🚀 Iniciando deployment AWS...\n");
    
    console.log("Iniciando deployment AWS...");

    try {
        const backendUrl = ServerManager.getBackendUrl();
        const userId = awsAuth.credentials.accessKey;
        
        setDeploymentLogs(prev => prev + "📡 Enviando credenciais para o servidor externo...\n");

        // Validar credenciais antes de enviar
        if (!awsAuth.credentials.accessKey || !awsAuth.credentials.secretKey || !awsAuth.credentials.region) {
            throw new Error('Credenciais AWS incompletas. Verifique se Access Key, Secret Key e Region estão preenchidos.');
        }

        // Forçar reinicialização do Terraform antes de cada deployment
        setDeploymentLogs(prev => prev + "🔄 Reinicializando Terraform...\n");
        
        const reinitResponse = await fetch(`${backendUrl}/api/terraform/reinit`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify({ userId: userId }),
            signal: AbortSignal.timeout(60000)
        });

        if (reinitResponse.ok) {
            setDeploymentLogs(prev => prev + "✅ Terraform reinicializado com sucesso!\n");
        }

        // Usar o método do ServerManager para enviar credenciais
        await ServerManager.sendCredentials(userId, awsAuth.credentials);

        setDeploymentLogs(prev => prev + "✅ Credenciais enviadas com sucesso!\n");
        setDeploymentLogs(prev => prev + "🚀 Iniciando deployment...\n");

        // Iniciar deployment
        const deploymentPayload = { 
            resources: selectedResources, 
            config: {
                ...config,
                securityGroupRules: selectedResources.securityGroup ? securityGroupRules : []
            }, 
            auth: { userId: userId }
        };

        console.log('Payload de deployment:', deploymentPayload);

        const response = await fetch(`${backendUrl}/api/aws/deploy`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify(deploymentPayload),
            signal: AbortSignal.timeout(300000) // 5 minutos timeout para deployment
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha na requisição de deployment (${response.status}): ${errorText}`);
        }

        // Processar logs em tempo real
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Falha ao obter o leitor de resposta.");
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const text = new TextDecoder().decode(value);
            const lines = text.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.type === 'log') {
                        setDeploymentLogs(prev => prev + data.message);
                    } else if (data.type === 'error') {
                        setDeploymentLogs(prev => prev + `\n❌ Erro: ${data.message}\n`);
                        toast({
                            title: "Deployment Falhou",
                            description: data.message,
                            variant: "destructive"
                        });
                    } else if (data.type === 'success') {
                        setDeploymentLogs(prev => prev + `\n✅ ${data.message}\n`);
                        toast({
                            title: "Deployment Completo",
                            description: data.message,
                        });
                    }
                } catch (parseError) {
                    setDeploymentLogs(prev => prev + line + '\n');
                }
            }
        }

    } catch (error) {
        console.error("Erro no deployment:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Verificar se é erro de rede
        if (error instanceof TypeError && error.message.includes('fetch')) {
            const networkError = `Erro de conexão com o backend em: ${ServerManager.getBackendUrl()}`;
            setDeploymentLogs(prev => prev + `\n❌ ${networkError}\n`);
            toast({
                title: "Erro de Conexão",
                description: networkError,
                variant: "destructive"
            });
        } else {
            setDeploymentLogs(prev => prev + `\n❌ Erro: ${errorMessage}\n`);
            toast({
                title: "Erro no Deployment",
                description: errorMessage,
                variant: "destructive"
            });
        }
    } finally {
        setIsDeploying(false);
    }
  };

  const generateTerraformPreview = () => {
    let terraformCode = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
  }
}

provider "aws" {
  region     = "${config.region}"
  access_key = var.access_key
  secret_key = var.secret_key
}

`;

    if (selectedResources.vpc) {
      terraformCode += `resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  enable_dns_hostnames = true
  enable_dns_support = true
  tags = {
    Name = "${config.vpcName}"
  }
}

`;
    }

    if (selectedResources.internetGateway) {
      terraformCode += `resource "aws_internet_gateway" "main" {
  vpc_id = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  tags = {
    Name = "main-igw"
  }
}

`;
    }

    if (selectedResources.publicSubnet) {
      terraformCode += `resource "aws_subnet" "public" {
  vpc_id                  = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block              = "${config.publicSubnetCidr}"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags = {
    Name = "${config.publicSubnetName}"
    Type = "Public"
  }
}

`;
    }

    if (selectedResources.privateSubnet) {
      terraformCode += `resource "aws_subnet" "private" {
  vpc_id            = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block        = "${config.privateSubnetCidr}"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags = {
    Name = "${config.privateSubnetName}"
    Type = "Private"
  }
}

`;
    }

    if (selectedResources.securityGroup && securityGroupRules.length > 0) {
      const vpcReference = selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`;
      terraformCode += `resource "aws_security_group" "web" {
  name        = "${config.sgName}"
  description = "${config.sgDescription}"
  vpc_id      = ${vpcReference}

`;

      securityGroupRules.forEach((rule, index) => {
        terraformCode += `  ${rule.type} {
    from_port   = ${rule.fromPort}
    to_port     = ${rule.toPort}
    protocol    = "${rule.protocol}"
    cidr_blocks = ["${rule.cidrBlocks}"]
    description = "${rule.description}"
  }

`;
      });

      terraformCode += `  tags = {
    Name = "${config.sgName}"
  }
}

`;
    }

    if (selectedResources.ec2) {
      let subnetRef = '';
      let securityGroupRef = '';
      
      if (selectedResources.publicSubnet) {
        subnetRef = 'subnet_id = aws_subnet.public.id';
      } else if (selectedResources.privateSubnet) {
        subnetRef = 'subnet_id = aws_subnet.private.id';
      } else if (config.existingSubnetId) {
        subnetRef = `subnet_id = "${config.existingSubnetId}"`;
      }
      
      if (selectedResources.securityGroup) {
        securityGroupRef = 'vpc_security_group_ids = [aws_security_group.web.id]';
      } else if (config.existingSecurityGroupId) {
        securityGroupRef = `vpc_security_group_ids = ["${config.existingSecurityGroupId}"]`;
      }

      terraformCode += `resource "aws_instance" "web" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "${config.instanceType}"
  key_name      = "${config.keyPair}"
  ${subnetRef}
  ${securityGroupRef}
  
  tags = {
    Name = "web-server"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

`;
    }

    return terraformCode;
  };

  if (!awsAuth.isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-white" />
              </div>
              <span>AWS Deployment</span>
            </h2>
            <p className="text-gray-600 mt-1">Configure and deploy your AWS infrastructure</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900">Autenticação Necessária</h3>
              <p className="text-gray-600 max-w-md">
                Você precisa fazer login na AWS com suas credenciais para acessar os recursos de deployment.
              </p>
              <p className="text-sm text-gray-500">
                Clique no botão de login AWS na barra lateral para continuar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resourcesList = [
    { key: 'vpc' as keyof SelectedResources, name: 'VPC', description: 'Virtual Private Cloud' },
    { key: 'internetGateway' as keyof SelectedResources, name: 'Internet Gateway', description: 'Conecta VPC à internet' },
    { key: 'publicSubnet' as keyof SelectedResources, name: 'Subnet Pública', description: 'Sub-rede com acesso à internet' },
    { key: 'privateSubnet' as keyof SelectedResources, name: 'Subnet Privada', description: 'Sub-rede sem acesso direto à internet' },
    { key: 'securityGroup' as keyof SelectedResources, name: 'Security Group', description: 'Firewall virtual' },
    { key: 'ec2' as keyof SelectedResources, name: 'EC2 Instance', description: 'Máquina virtual' },
    { key: 'loadBalancer' as keyof SelectedResources, name: 'Load Balancer', description: 'Distribuidor de carga' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span>AWS Deployment</span>
          </h2>
          <p className="text-gray-600 mt-1">Selecione e configure os recursos AWS que deseja criar</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Autenticado
          </Badge>
          <Badge variant="secondary" className={isServerRunning ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
            Server: {isServerRunning ? "Online" : "Offline"}
          </Badge>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            Provider: AWS
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Selection */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Seleção de Recursos</CardTitle>
            <CardDescription>
              Escolha quais recursos AWS você deseja criar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resourcesList.map((resource) => (
              <div key={resource.key} className="flex items-center space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={resource.key}
                  checked={selectedResources[resource.key]}
                  onCheckedChange={(checked) => handleResourceChange(resource.key, checked as boolean)}
                />
                <div className="flex-1">
                  <Label htmlFor={resource.key} className="text-sm font-medium">
                    {resource.name}
                  </Label>
                  <p className="text-xs text-gray-500">{resource.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Configure os parâmetros dos recursos selecionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">AWS Region</Label>
                <Input
                  id="region"
                  value={config.region}
                  onChange={(e) => setConfig({ ...config, region: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="instanceType">Instance Type</Label>
                <Input
                  id="instanceType"
                  value={config.instanceType}
                  onChange={(e) => setConfig({ ...config, instanceType: e.target.value })}
                  disabled={!selectedResources.ec2}
                />
              </div>
            </div>
            
            {selectedResources.vpc && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Configuração VPC</h4>
                <div>
                  <Label htmlFor="vpcName">Nome da VPC</Label>
                  <Input
                    id="vpcName"
                    value={config.vpcName}
                    onChange={(e) => setConfig({ ...config, vpcName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="vpcCidr">CIDR Block</Label>
                  <Input
                    id="vpcCidr"
                    value={config.vpcCidr}
                    onChange={(e) => setConfig({ ...config, vpcCidr: e.target.value })}
                  />
                </div>
              </div>
            )}

            {selectedResources.publicSubnet && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Configuração Subnet Pública</h4>
                <div>
                  <Label htmlFor="publicSubnetName">Nome da Subnet Pública</Label>
                  <Input
                    id="publicSubnetName"
                    value={config.publicSubnetName}
                    onChange={(e) => setConfig({ ...config, publicSubnetName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="publicSubnetCidr">CIDR Block</Label>
                  <Input
                    id="publicSubnetCidr"
                    value={config.publicSubnetCidr}
                    onChange={(e) => setConfig({ ...config, publicSubnetCidr: e.target.value })}
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="existingVpcId">ID da VPC Existente</Label>
                    <Input
                      id="existingVpcId"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedResources.privateSubnet && (
              <div className="space-y-3 p-3 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-900">Configuração Subnet Privada</h4>
                <div>
                  <Label htmlFor="privateSubnetName">Nome da Subnet Privada</Label>
                  <Input
                    id="privateSubnetName"
                    value={config.privateSubnetName}
                    onChange={(e) => setConfig({ ...config, privateSubnetName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="privateSubnetCidr">CIDR Block</Label>
                  <Input
                    id="privateSubnetCidr"
                    value={config.privateSubnetCidr}
                    onChange={(e) => setConfig({ ...config, privateSubnetCidr: e.target.value })}
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="existingVpcIdPrivate">ID da VPC Existente</Label>
                    <Input
                      id="existingVpcIdPrivate"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedResources.securityGroup && (
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">Configuração Security Group</h4>
                <div>
                  <Label htmlFor="sgName">Nome do Security Group *</Label>
                  <Input
                    id="sgName"
                    value={config.sgName}
                    onChange={(e) => setConfig({ ...config, sgName: e.target.value })}
                    placeholder="web-security-group"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sgDescription">Descrição *</Label>
                  <Input
                    id="sgDescription"
                    value={config.sgDescription}
                    onChange={(e) => setConfig({ ...config, sgDescription: e.target.value })}
                    placeholder="Security group for web servers"
                    required
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="existingVpcIdSg">ID da VPC Existente *</Label>
                    <Input
                      id="existingVpcIdSg"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                      required
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Regras de Segurança *</Label>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      onClick={addSecurityGroupRule}
                    >
                      Adicionar Regra
                    </Button>
                  </div>
                  
                  {securityGroupRules.map((rule, index) => (
                    <div key={index} className="border p-3 rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">Regra {index + 1}</Label>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeSecurityGroupRule(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Tipo *</Label>
                          <select 
                            className="w-full h-9 px-3 py-2 border border-input rounded-md text-sm"
                            value={rule.type}
                            onChange={(e) => updateSecurityGroupRule(index, 'type', e.target.value)}
                          >
                            <option value="ingress">Ingress (Entrada)</option>
                            <option value="egress">Egress (Saída)</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Protocolo *</Label>
                          <Input
                            value={rule.protocol}
                            onChange={(e) => updateSecurityGroupRule(index, 'protocol', e.target.value)}
                            placeholder="tcp, udp, icmp"
                            className="h-9 text-sm"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Porta Inicial *</Label>
                          <Input
                            value={rule.fromPort}
                            onChange={(e) => updateSecurityGroupRule(index, 'fromPort', e.target.value)}
                            placeholder="80"
                            className="h-9 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Porta Final *</Label>
                          <Input
                            value={rule.toPort}
                            onChange={(e) => updateSecurityGroupRule(index, 'toPort', e.target.value)}
                            placeholder="80"
                            className="h-9 text-sm"
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs">CIDR Blocks *</Label>
                        <Input
                          value={rule.cidrBlocks}
                          onChange={(e) => updateSecurityGroupRule(index, 'cidrBlocks', e.target.value)}
                          placeholder="0.0.0.0/0"
                          className="h-9 text-sm"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Descrição *</Label>
                        <Input
                          value={rule.description}
                          onChange={(e) => updateSecurityGroupRule(index, 'description', e.target.value)}
                          placeholder="Allow HTTP traffic"
                          className="h-9 text-sm"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedResources.ec2 && (
              <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900">Configuração EC2</h4>
                <div>
                  <Label htmlFor="keyPair">Key Pair Name *</Label>
                  <Input
                    id="keyPair"
                    value={config.keyPair}
                    onChange={(e) => setConfig({ ...config, keyPair: e.target.value })}
                    placeholder="my-keypair"
                    required
                  />
                </div>
                {!selectedResources.publicSubnet && !selectedResources.privateSubnet && (
                  <div>
                    <Label htmlFor="existingSubnetId">ID da Subnet Existente</Label>
                    <Input
                      id="existingSubnetId"
                      value={config.existingSubnetId}
                      onChange={(e) => setConfig({ ...config, existingSubnetId: e.target.value })}
                      placeholder="subnet-xxxxxxxxx"
                    />
                  </div>
                )}
                {!selectedResources.securityGroup && (
                  <div>
                    <Label htmlFor="existingSecurityGroupId">ID do Security Group Existente</Label>
                    <Input
                      id="existingSecurityGroupId"
                      value={config.existingSecurityGroupId}
                      onChange={(e) => setConfig({ ...config, existingSecurityGroupId: e.target.value })}
                      placeholder="sg-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleDeploy} 
                disabled={isDeploying}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isDeploying ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Executando terraform apply...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Deploy Infrastructure
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowTerraform(!showTerraform)}
              >
                {showTerraform ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showTerraform ? 'Ocultar' : 'Ver'} Terraform
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terraform Code Preview */}
      {showTerraform && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Preview do Código Terraform</CardTitle>
            <CardDescription>
              Código que será executado baseado na sua seleção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {generateTerraformPreview()}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Resources Summary */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Recursos Selecionados</CardTitle>
          <CardDescription>
            Resumo dos recursos que serão criados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedResources).map(([key, selected]) => {
              if (!selected) return null;
              const resource = resourcesList.find(r => r.key === key);
              return (
                <Badge key={key} className="bg-orange-100 text-orange-700">
                  {resource?.name}
                </Badge>
              );
            })}
            {Object.values(selectedResources).every(v => !v) && (
              <p className="text-gray-500 text-sm">Nenhum recurso selecionado</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deployment Logs - Sempre visível após primeira execução */}
      {hasExecuted && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Logs de Execução</span>
              <div className="flex items-center space-x-2">
                {isDeploying && (
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-600">
                      Executando terraform apply...
                    </span>
                  </div>
                )}
                {!isDeploying && deploymentLogs && (
                  <Badge className="bg-green-100 text-green-700">
                    Concluído
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Logs do deployment AWS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {deploymentLogs || "Aguardando execução..."}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AWSDeployment;
