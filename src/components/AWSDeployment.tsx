import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Play, RotateCcw, Eye, EyeOff, AlertCircle, Info, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";
import SSMInstructionsModal from "./SSMInstructionsModal";
import LogFormatter from "./LogFormatter";

interface SelectedResources {
  vpc: boolean;
  publicSubnet: boolean;
  privateSubnet: boolean;
  securityGroup: boolean;
  ec2: boolean;
  internetGateway: boolean;
  loadBalancer: boolean;
}

interface SecurityGroupRule {
  type: 'ingress' | 'egress';
  protocol: string;
  fromPort: string;
  toPort: string;
  source: string;
  description: string;
}

interface CreatedResource {
  id: string;
  type: string;
  name: string;
  deploymentId: string;
  createdAt: string;
  status: string;
}

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth, isServerRunning } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerraform, setShowTerraform] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string>("");
  const [createdResources, setCreatedResources] = useState<CreatedResource[]>([]);
  const [securityGroupRules, setSecurityGroupRules] = useState<SecurityGroupRule[]>([]);
  const [showSSMModal, setShowSSMModal] = useState(false);
  const [lastCreatedInstanceType, setLastCreatedInstanceType] = useState<'linux' | 'windows'>('linux');
  const [lastCreatedInstanceId, setLastCreatedInstanceId] = useState<string>('');
  const [deploymentError, setDeploymentError] = useState<string>('');
  
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({
    vpc: false,
    publicSubnet: false,
    privateSubnet: false,
    securityGroup: false,
    ec2: false,
    internetGateway: false,
    loadBalancer: false
  });

  const [config, setConfig] = useState({
    vpcName: "main-vpc",
    vpcCidr: "10.0.0.0/16",
    internetGatewayName: "main-igw",
    internetGatewayVpcId: "",
    publicSubnetName: "public-subnet",
    publicSubnetCidr: "10.0.1.0/24",
    privateSubnetName: "private-subnet", 
    privateSubnetCidr: "10.0.2.0/24",
    loadBalancerName: "main-lb",
    loadBalancerType: "application",
    instanceType: "t3.medium",
    instanceName: "main-instance",
    osType: "windows",
    sgName: "main-sg",
    existingVpcId: "",
    existingPublicSubnetId: "",
    existingPrivateSubnetId: "",
    existingSecurityGroupId: ""
  });

  useEffect(() => {
    loadCreatedResources();
  }, [awsAuth.isAuthenticated]);

  const loadCreatedResources = async () => {
    if (!awsAuth.isAuthenticated || !isServerRunning) return;
    
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : '';
      
      const response = await fetch(`${backendUrl}/api/aws/resources/${userId}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedResources(data.resources || []);
        console.log('✅ Recursos carregados:', data.resources?.length || 0);
      }
    } catch (error) {
      console.error('Error loading created resources:', error);
    }
  };

  const handleResourceChange = (resource: keyof SelectedResources, checked: boolean) => {
    setSelectedResources(prev => ({ ...prev, [resource]: checked }));
  };

  const addSecurityGroupRule = () => {
    setSecurityGroupRules(prev => [...prev, {
      type: 'ingress',
      protocol: 'tcp',
      fromPort: '',
      toPort: '',
      source: '0.0.0.0/0',
      description: ''
    }]);
  };

  const updateSecurityGroupRule = (index: number, field: keyof SecurityGroupRule, value: string) => {
    setSecurityGroupRules(prev => prev.map((rule, i) => 
      i === index ? { ...rule, [field]: value } : rule
    ));
  };

  const removeSecurityGroupRule = (index: number) => {
    setSecurityGroupRules(prev => prev.filter((_, i) => i !== index));
  };

  const deleteCreatedResource = async (resourceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este recurso? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : '';
      
      const response = await fetch(`${backendUrl}/api/aws/resource/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId }),
      });

      if (response.ok) {
        toast({
          title: "Recurso excluído",
          description: "O recurso foi excluído com sucesso.",
        });
        loadCreatedResources();
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

  const cleanAnsiCodes = (text: string) => {
    return text.replace(/\x1b\[[0-9;]*[mGK]/g, '');
  };

  const parseAWSError = (errorMessage: string) => {
    if (errorMessage.includes('VpcLimitExceeded')) {
      return {
        type: 'VPC_LIMIT',
        title: 'Limite de VPCs Atingido',
        message: 'Sua conta AWS atingiu o limite máximo de VPCs. Você precisa deletar VPCs não utilizadas ou usar uma VPC existente.',
        suggestions: [
          'Delete VPCs não utilizadas no Console AWS',
          'Use uma VPC existente desmarcando "VPC" e preenchendo "ID da VPC Existente"',
          'Solicite aumento de limite à AWS (demora alguns dias)'
        ]
      };
    }
    
    if (errorMessage.includes('UnauthorizedOperation')) {
      return {
        type: 'PERMISSION',
        title: 'Erro de Permissão',
        message: 'Suas credenciais AWS não têm permissão para criar este recurso.',
        suggestions: [
          'Verifique se suas credenciais AWS têm as permissões necessárias',
          'Entre em contato com o administrador da sua conta AWS'
        ]
      };
    }

    return {
      type: 'GENERAL',
      title: 'Erro no Deployment',
      message: errorMessage,
      suggestions: ['Verifique os logs para mais detalhes']
    };
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

    setIsDeploying(true);
    setDeploymentLogs("🚀 Iniciando deployment AWS...\n");
    setDeploymentError('');
    
    try {
        const backendUrl = ServerManager.getBackendUrl();
        const userId = awsAuth.credentials.accessKey;
        
        setDeploymentLogs(prev => prev + "📡 Enviando credenciais para o servidor externo...\n");

        if (!awsAuth.credentials.accessKey || !awsAuth.credentials.secretKey || !awsAuth.credentials.region) {
            throw new Error('Credenciais AWS incompletas. Verifique se Access Key, Secret Key e Region estão preenchidos.');
        }

        setDeploymentLogs(prev => prev + "🔄 Preparando Terraform para nova execução...\n");
        
        try {
          await ServerManager.reinitializeTerraform(userId);
          setDeploymentLogs(prev => prev + "✅ Terraform preparado com sucesso!\n");
        } catch (reinitError) {
          console.log("Aviso: Falha na reinicialização do Terraform, continuando...");
          setDeploymentLogs(prev => prev + "⚠️  Terraform já estava inicializado, continuando...\n");
        }

        await ServerManager.sendCredentials(userId, awsAuth.credentials);

        setDeploymentLogs(prev => prev + "✅ Credenciais enviadas com sucesso!\n");
        setDeploymentLogs(prev => prev + "🚀 Iniciando deployment...\n");

        const deploymentPayload = { 
            resources: selectedResources, 
            config: config,
            securityGroupRules: securityGroupRules,
            auth: { userId: userId },
            storeConfig: true
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
            signal: AbortSignal.timeout(300000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha na requisição de deployment (${response.status}): ${errorText}`);
        }

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
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + cleanedMessage);
                    } else if (data.type === 'error') {
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + `\n❌ Erro: ${cleanedMessage}\n`);
                        setDeploymentError(cleanedMessage);
                        
                        const errorInfo = parseAWSError(cleanedMessage);
                        toast({
                            title: errorInfo.title,
                            description: errorInfo.message,
                            variant: "destructive"
                        });

                        // Load resources even on error - some might have been created
                        if (data.resources && data.resources.length > 0) {
                          setDeploymentLogs(prev => prev + `\n📋 Recursos criados antes do erro:\n${data.resources.map((r: any) => `• ${r.type}: ${r.id}`).join('\n')}\n`);
                          loadCreatedResources();
                        }
                    } else if (data.type === 'success') {
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + `\n✅ ${cleanedMessage}\n`);
                        setDeploymentError('');
                        
                        if (data.resources) {
                          setDeploymentLogs(prev => prev + `\n📋 Recursos criados:\n${data.resources.map((r: any) => `• ${r.type}: ${r.id}`).join('\n')}\n`);
                          
                          // Check if EC2 instance was created and show modal
                          const ec2Instance = data.resources.find((r: any) => r.type === 'instance');
                          if (ec2Instance && selectedResources.ec2) {
                            setLastCreatedInstanceType(config.osType as 'linux' | 'windows');
                            setLastCreatedInstanceId(ec2Instance.id);
                            setShowSSMModal(true);
                          }
                          
                          loadCreatedResources();
                        }
                        
                        toast({
                            title: "Deployment Completo",
                            description: "Recursos criados com sucesso!",
                        });
                    }
                } catch (parseError) {
                    const cleanedLine = cleanAnsiCodes(line);
                    setDeploymentLogs(prev => prev + cleanedLine + '\n');
                }
            }
        }

    } catch (error) {
        console.error("Erro no deployment:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
            const networkError = `Erro de conexão com o backend em: ${ServerManager.getBackendUrl()}`;
            setDeploymentLogs(prev => prev + `\n❌ ${networkError}\n`);
            setDeploymentError(networkError);
            toast({
                title: "Erro de Conexão",
                description: networkError,
                variant: "destructive"
            });
        } else {
            setDeploymentLogs(prev => prev + `\n❌ Erro: ${errorMessage}\n`);
            setDeploymentError(errorMessage);
            toast({
                title: "Erro no Deployment",
                description: errorMessage,
                variant: "destructive"
            });
        }
    } finally {
        setIsDeploying(false);
        // Always try to load resources after deployment completes
        setTimeout(() => {
          loadCreatedResources();
        }, 1000);
    }
  };

  const generateTerraformPreview = () => {
    let code = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
  }
}

provider "aws" {
  region = var.region
  access_key = var.access_key
  secret_key = var.secret_key
}

`;

    if (selectedResources.vpc) {
        code += `
resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  tags = {
    Name = "${config.vpcName}"
  }
}
`;
    }

    if (selectedResources.internetGateway) {
        const vpcReference = selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.internetGatewayVpcId || config.existingVpcId}"`;
        code += `
resource "aws_internet_gateway" "main" {
  vpc_id = ${vpcReference}
  tags = {
    Name = "${config.internetGatewayName}"
  }
}
`;
    }

    if (selectedResources.publicSubnet) {
        code += `
resource "aws_subnet" "public" {
  vpc_id     = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block = "${config.publicSubnetCidr}"
  map_public_ip_on_launch = true
  tags = {
    Name = "${config.publicSubnetName}"
  }
}
`;
    }

    if (selectedResources.privateSubnet) {
        code += `
resource "aws_subnet" "private" {
  vpc_id     = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block = "${config.privateSubnetCidr}"
  tags = {
    Name = "${config.privateSubnetName}"
  }
}
`;
    }

    if (selectedResources.securityGroup && securityGroupRules.length > 0) {
        code += `
resource "aws_security_group" "main" {
  name        = "${config.sgName}"
  description = "Custom security group"
  vpc_id      = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}

`;
        securityGroupRules.forEach((rule, index) => {
            code += `  ${rule.type} {
    from_port   = ${rule.fromPort}
    to_port     = ${rule.toPort}
    protocol    = "${rule.protocol}"
    cidr_blocks = ["${rule.source}"]
    description = "${rule.description}"
  }

`;
        });

        code += `  tags = {
    Name = "${config.sgName}"
  }
}
`;
    }

    if (selectedResources.loadBalancer) {
        code += `
resource "aws_lb" "main" {
  name               = "${config.loadBalancerName}"
  internal           = false
  load_balancer_type = "${config.loadBalancerType}"
  security_groups    = ${selectedResources.securityGroup ? '[aws_security_group.main.id]' : '[]'}
  subnets            = ${selectedResources.publicSubnet ? '[aws_subnet.public.id]' : '[]'}

  tags = {
    Name = "${config.loadBalancerName}"
  }
}
`;
    }

    if (selectedResources.ec2) {
        const amiMap = {
            windows: 'ami-0c02fb55956c7d316',
            linux: 'ami-0abcdef1234567890'
        };

        let subnetRef = '';
        if (selectedResources.publicSubnet) {
            subnetRef = 'subnet_id     = aws_subnet.public.id';
        } else if (selectedResources.privateSubnet) {
            subnetRef = 'subnet_id     = aws_subnet.private.id';
        } else if (config.existingPublicSubnetId) {
            subnetRef = `subnet_id     = "${config.existingPublicSubnetId}"`;
        }

        let securityGroupRef = '';
        if (selectedResources.securityGroup) {
            securityGroupRef = 'vpc_security_group_ids = [aws_security_group.main.id]';
        } else if (config.existingSecurityGroupId) {
            securityGroupRef = `vpc_security_group_ids = ["${config.existingSecurityGroupId}"]`;
        }

        if (config.osType === 'windows') {
            code += `
# IAM role for SSM
resource "aws_iam_role" "ssm_role" {
  name = "EC2-SSM-Role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm_profile" {
  name = "EC2-SSM-Profile"
  role = aws_iam_role.ssm_role.name
}

resource "aws_instance" "main" {
  ami           = "${amiMap[config.osType as keyof typeof amiMap]}"
  instance_type = "${config.instanceType}"
  ${subnetRef}
  ${securityGroupRef}
  iam_instance_profile = aws_iam_instance_profile.ssm_profile.name

  user_data = <<-EOF
              <powershell>
              Enable-PSRemoting -Force
              Set-Item WSMan:\\localhost\\Client\\TrustedHosts -Value "*" -Force
              </powershell>
              EOF

  tags = {
    Name = "${config.instanceName}"
    OS = "Windows"
    SSM = "Enabled"
  }
}
`;
        } else {
            code += `
resource "aws_instance" "main" {
  ami           = "${amiMap[config.osType as keyof typeof amiMap]}"
  instance_type = "${config.instanceType}"
  ${subnetRef}
  ${securityGroupRef}

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y amazon-ssm-agent
              systemctl enable amazon-ssm-agent
              systemctl start amazon-ssm-agent
              EOF

  tags = {
    Name = "${config.instanceName}"
    OS = "Linux"
  }
}
`;
        }
    }

    return code;
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
            <p className="text-gray-600 mt-1">Configure e implante sua infraestrutura AWS</p>
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
    { key: 'securityGroup' as keyof SelectedResources, name: 'Security Group', description: 'Firewall configurável' },
    { key: 'loadBalancer' as keyof SelectedResources, name: 'Load Balancer', description: 'Distribuidor de carga' },
    { key: 'ec2' as keyof SelectedResources, name: 'Instância EC2', description: 'Servidor virtual (Linux ou Windows)' }
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
          <p className="text-gray-600 mt-1">Configure e implante sua infraestrutura AWS</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Autenticado
          </Badge>
          <Badge variant="secondary" className={isServerRunning ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
            Server: {isServerRunning ? "Online" : "Offline"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Configure os parâmetros dos recursos selecionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
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

            {selectedResources.internetGateway && (
              <div className="space-y-3 p-3 bg-cyan-50 rounded-lg">
                <h4 className="font-medium text-cyan-900">Internet Gateway</h4>
                <div>
                  <Label htmlFor="internetGatewayName">Nome do Internet Gateway</Label>
                  <Input
                    id="internetGatewayName"
                    value={config.internetGatewayName}
                    onChange={(e) => setConfig({ ...config, internetGatewayName: e.target.value })}
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="internetGatewayVpcId">ID da VPC para associar *</Label>
                    <Input
                      id="internetGatewayVpcId"
                      value={config.internetGatewayVpcId}
                      onChange={(e) => setConfig({ ...config, internetGatewayVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                    <p className="text-xs text-cyan-700 mt-1">
                      ⚠️ Obrigatório: ID da VPC onde o Internet Gateway será associado
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedResources.publicSubnet && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Subnet Pública</h4>
                <div>
                  <Label htmlFor="publicSubnetName">Nome da Subnet</Label>
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
                    <Label htmlFor="existingVpcId">ID da VPC Existente *</Label>
                    <Input
                      id="existingVpcId"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                    <p className="text-xs text-green-700 mt-1">
                      ⚠️ Obrigatório se não criar VPC nova
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedResources.privateSubnet && (
              <div className="space-y-3 p-3 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-900">Subnet Privada</h4>
                <div>
                  <Label htmlFor="privateSubnetName">Nome da Subnet</Label>
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
                    <Label htmlFor="existingVpcIdPrivate">ID da VPC Existente *</Label>
                    <Input
                      id="existingVpcIdPrivate"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                    <p className="text-xs text-yellow-700 mt-1">
                      ⚠️ Obrigatório se não criar VPC nova
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedResources.loadBalancer && (
              <div className="space-y-3 p-3 bg-indigo-50 rounded-lg">
                <h4 className="font-medium text-indigo-900">Load Balancer</h4>
                <div>
                  <Label htmlFor="loadBalancerName">Nome do Load Balancer</Label>
                  <Input
                    id="loadBalancerName"
                    value={config.loadBalancerName}
                    onChange={(e) => setConfig({ ...config, loadBalancerName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="loadBalancerType">Tipo</Label>
                  <Select 
                    value={config.loadBalancerType}
                    onValueChange={(value) => setConfig({ ...config, loadBalancerType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application">Application Load Balancer</SelectItem>
                      <SelectItem value="network">Network Load Balancer</SelectItem>
                      <SelectItem value="gateway">Gateway Load Balancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {selectedResources.securityGroup && (
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-purple-900">Security Group</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSecurityGroupRule}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Regra
                  </Button>
                </div>
                <div>
                  <Label htmlFor="sgName">Nome do Security Group</Label>
                  <Input
                    id="sgName"
                    value={config.sgName}
                    onChange={(e) => setConfig({ ...config, sgName: e.target.value })}
                  />
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {securityGroupRules.length === 0 ? (
                    <p className="text-sm text-purple-600 text-center py-2">
                      Nenhuma regra definida. Clique em "Adicionar Regra" para configurar o tráfego.
                    </p>
                  ) : (
                    securityGroupRules.map((rule, index) => (
                      <div key={index} className="p-2 border rounded bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <Select 
                            value={rule.type}
                            onValueChange={(value) => updateSecurityGroupRule(index, 'type', value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ingress">Entrada</SelectItem>
                              <SelectItem value="egress">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSecurityGroupRule(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Protocolo (tcp/udp)"
                            value={rule.protocol}
                            onChange={(e) => updateSecurityGroupRule(index, 'protocol', e.target.value)}
                          />
                          <Input
                            placeholder="Porta inicial"
                            value={rule.fromPort}
                            onChange={(e) => updateSecurityGroupRule(index, 'fromPort', e.target.value)}
                          />
                          <Input
                            placeholder="Porta final"
                            value={rule.toPort}
                            onChange={(e) => updateSecurityGroupRule(index, 'toPort', e.target.value)}
                          />
                          <Input
                            placeholder="Origem (CIDR)"
                            value={rule.source}
                            onChange={(e) => updateSecurityGroupRule(index, 'source', e.target.value)}
                          />
                        </div>
                        <Input
                          placeholder="Descrição"
                          value={rule.description}
                          onChange={(e) => updateSecurityGroupRule(index, 'description', e.target.value)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {selectedResources.ec2 && (
              <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900">Configuração EC2</h4>
                <div>
                  <Label htmlFor="instanceName">Nome da Instância</Label>
                  <Input
                    id="instanceName"
                    value={config.instanceName}
                    onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="osType">Sistema Operacional</Label>
                  <Select 
                    value={config.osType}
                    onValueChange={(value) => setConfig({ ...config, osType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linux">Linux (Amazon Linux 2)</SelectItem>
                      <SelectItem value="windows">Windows Server 2022</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="instanceType">Tipo da Instância</Label>
                  <Select 
                    value={config.instanceType}
                    onValueChange={(value) => setConfig({ ...config, instanceType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="t3.micro">t3.micro</SelectItem>
                      <SelectItem value="t3.small">t3.small</SelectItem>
                      <SelectItem value="t3.medium">t3.medium (Recomendado)</SelectItem>
                      <SelectItem value="t3.large">t3.large</SelectItem>
                      <SelectItem value="m5.large">m5.large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="mt-4 p-3 bg-orange-100 rounded-lg border-l-4 border-orange-500">
                  <div className="flex items-start space-x-2">
                    <Info className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium mb-2">📋 Informações importantes sobre acesso:</p>
                      {config.osType === 'windows' ? (
                        <div className="space-y-2">
                          <p>✅ <strong>Windows Server 2022</strong> com SSM habilitado automaticamente</p>
                          <p>🔑 <strong>Acesso via Session Manager:</strong> Não precisa de chaves SSH</p>
                          <p>🖥️ <strong>Acesso RDP:</strong> Via túnel SSM</p>
                          <p>⚡ <strong>Pronto para usar:</strong> PowerShell remoto habilitado</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p>✅ <strong>Amazon Linux 2</strong> com SSM Agent instalado automaticamente</p>
                          <p>🔑 <strong>Acesso via Session Manager:</strong> Terminal bash direto</p>
                          <p>🐧 <strong>Sistema atualizado:</strong> yum update executado na inicialização</p>
                          <p>⚡ <strong>Pronto para usar:</strong> SSH não necessário</p>
                        </div>
                      )}
                      <p className="mt-2 text-orange-700 font-medium">
                        ℹ️ Instruções de acesso completas aparecerão após a criação da instância.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Recursos Criados</CardTitle>
            <CardDescription>
              Recursos AWS criados pelos seus deployments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {createdResources.length === 0 ? (
              <div className="text-center py-8">
                <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum recurso criado ainda</p>
                <p className="text-sm text-gray-400 mt-1">
                  Execute um deployment para ver os recursos aqui
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {createdResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{resource.name}</p>
                      <p className="text-xs text-gray-500">{resource.type}</p>
                      <p className="text-xs text-gray-400 font-mono">{resource.id}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(resource.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="secondary" 
                        className={resource.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                      >
                        {resource.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteCreatedResource(resource.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex space-x-2">
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

      {deploymentLogs && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Logs de Execução</span>
              {isDeploying && (
                <div className="flex items-center space-x-2">
                  <RotateCcw className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-600">
                    Executando terraform apply...
                  </span>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              Logs do deployment AWS em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogFormatter logs={deploymentLogs} />
          </CardContent>
        </Card>
      )}

      {deploymentError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-red-900 mb-2">
                  {deploymentError.includes('VpcLimitExceeded') ? 'Limite de VPCs Atingido' : 'Erro no Deployment'}
                </h3>
                {deploymentError.includes('VpcLimitExceeded') ? (
                  <div className="text-sm text-red-800 space-y-2">
                    <p>Sua conta AWS atingiu o limite máximo de VPCs. Para resolver:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Delete VPCs não utilizadas no Console AWS</li>
                      <li>Use uma VPC existente (desmarque "VPC" e preencha o ID da VPC)</li>
                      <li>Solicite aumento de limite à AWS</li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-red-800">{deploymentError}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SSMInstructionsModal
        isOpen={showSSMModal}
        onClose={() => setShowSSMModal(false)}
        osType={lastCreatedInstanceType}
        instanceId={lastCreatedInstanceId}
      />
    </div>
  );
};

export default AWSDeployment;
