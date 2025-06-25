import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Play, RotateCcw, Eye, EyeOff, AlertCircle, Info, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

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
    // VPC Config
    vpcName: "main-vpc",
    vpcCidr: "10.0.0.0/16",
    
    // Internet Gateway Config
    internetGatewayName: "main-igw",
    internetGatewayVpcId: "",
    
    // Public Subnet Config
    publicSubnetName: "public-subnet",
    publicSubnetCidr: "10.0.1.0/24",
    
    // Private Subnet Config
    privateSubnetName: "private-subnet", 
    privateSubnetCidr: "10.0.2.0/24",
    
    // Load Balancer Config
    loadBalancerName: "main-lb",
    loadBalancerType: "application",
    
    // EC2 Config
    instanceType: "t3.medium",
    instanceName: "main-instance",
    osType: "windows", // windows or linux
    
    // Security Group Config
    sgName: "main-sg",
    
    // Existing Resources
    existingVpcId: "",
    existingPublicSubnetId: "",
    existingPrivateSubnetId: "",
    existingSecurityGroupId: ""
  });

  // Load created resources on component mount
  useEffect(() => {
    loadCreatedResources();
  }, [awsAuth.isAuthenticated]);

  const loadCreatedResources = async () => {
    if (!awsAuth.isAuthenticated || !isServerRunning) return;
    
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : '';
      
      const response = await fetch(`${backendUrl}/api/aws/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedResources(data.resources || []);
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
        loadCreatedResources(); // Reload resources
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

  // Clean ANSI codes from logs
  const cleanAnsiCodes = (text: string) => {
    return text.replace(/\x1b\[[0-9;]*[mGK]/g, '');
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
                        toast({
                            title: "Deployment Falhou",
                            description: cleanedMessage,
                            variant: "destructive"
                        });
                    } else if (data.type === 'success') {
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + `\n✅ ${cleanedMessage}\n`);
                        if (data.resources) {
                          setDeploymentLogs(prev => prev + `\n📋 Recursos criados:\n${data.resources.map((r: any) => `• ${r.type}: ${r.id}`).join('\n')}\n`);
                        }
                        toast({
                            title: "Deployment Completo",
                            description: "Recursos criados com sucesso! Terraform configuração salva.",
                        });
                        // Reload created resources after successful deployment
                        loadCreatedResources();
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
            windows: 'ami-0c02fb55956c7d316', // Windows Server 2022
            linux: 'ami-0abcdef1234567890'     // Amazon Linux 2
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

      {/* Complete SSM Access Information */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <Info className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-4 flex-1">
              <div>
                <h4 className="text-lg font-semibold text-blue-900 mb-3">🔐 Acessando EC2 via SSM — Passo a Passo (Linux e Windows)</h4>
              </div>
              
              <div className="text-sm text-blue-800 space-y-4">
                <div className="bg-blue-100 p-4 rounded-lg">
                  <strong className="text-blue-900">☁️ Pré-requisitos (válido para ambos):</strong>
                  <ul className="list-disc list-inside ml-2 mt-2 space-y-1">
                    <li><strong>AWS CLI instalada</strong> → <a href="https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html" className="underline text-blue-700" target="_blank" rel="noopener noreferrer">https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html</a></li>
                    <li><strong>Session Manager Plugin instalado</strong> → <a href="https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html" className="underline text-blue-700" target="_blank" rel="noopener noreferrer">Link oficial</a></li>
                    <li><strong>Autenticação configurada:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-blue-900">aws configure</code></li>
                  </ul>
                </div>
                
                <div className="bg-blue-100 p-4 rounded-lg">
                  <strong className="text-blue-900">🔑 Seu usuário IAM precisa de permissões SSM:</strong>
                  <pre className="bg-blue-200 p-3 rounded mt-2 text-xs overflow-x-auto text-blue-900">
{`{
  "Effect": "Allow",
  "Action": [
    "ssm:StartSession",
    "ssm:DescribeInstanceInformation",
    "ssm:DescribeSessions",
    "ssm:TerminateSession"
  ],
  "Resource": "*"
}`}
                  </pre>
                </div>
                
                <div className="bg-green-100 p-4 rounded-lg">
                  <strong className="text-green-900">🐧 Conectar em EC2 Linux via SSM:</strong>
                  <code className="block bg-green-200 p-3 rounded mt-2 text-sm text-green-900">
                    aws ssm start-session --target &lt;INSTANCE_ID&gt;
                  </code>
                  <p className="text-sm mt-2 text-green-800">
                    <strong>Exemplo:</strong> <code className="bg-green-200 px-2 py-1 rounded">aws ssm start-session --target i-0123456789abcdef0</code>
                  </p>
                  <p className="text-sm mt-1 text-green-800">
                    <strong>Resultado esperado:</strong> <code className="bg-green-200 px-2 py-1 rounded">[ec2-user@ip-10-0-0-123 ~]$</code>
                  </p>
                </div>
                
                <div className="bg-purple-100 p-4 rounded-lg">
                  <strong className="text-purple-900">🪟 Conectar em EC2 Windows via SSM (terminal):</strong>
                  <code className="block bg-purple-200 p-3 rounded mt-2 text-sm text-purple-900">
                    aws ssm start-session --target &lt;INSTANCE_ID&gt;
                  </code>
                  <p className="text-sm mt-2 text-purple-800">
                    <strong>Exemplo:</strong> <code className="bg-purple-200 px-2 py-1 rounded">aws ssm start-session --target i-0abcde1234567890f</code>
                  </p>
                  <p className="text-sm mt-1 text-purple-800">
                    <strong>Resultado esperado:</strong> <code className="bg-purple-200 px-2 py-1 rounded">C:\Users\Administrator&gt;</code>
                  </p>
                </div>
                
                <div className="bg-indigo-100 p-4 rounded-lg">
                  <strong className="text-indigo-900">🖥️ (Opcional) Acessar Windows com RDP via túnel SSM:</strong>
                  <pre className="bg-indigo-200 p-3 rounded mt-2 text-xs overflow-x-auto text-indigo-900">
{`aws ssm start-session \\
  --target <INSTANCE_ID> \\
  --document-name AWS-StartPortForwardingSession \\
  --parameters '{"portNumber":["3389"],"localPortNumber":["13389"]}'`}
                  </pre>
                  <p className="text-sm mt-2 text-indigo-800">
                    Em seguida, abra o <strong>Remote Desktop (mstsc)</strong> e conecte em: <code className="bg-indigo-200 px-2 py-1 rounded">localhost:13389</code>
                  </p>
                  <p className="text-sm mt-1 text-indigo-800 font-medium">
                    🔐 Você acessa via túnel seguro, sem IP público nem abrir portas na instância.
                  </p>
                </div>
                
                <div className="bg-yellow-100 p-4 rounded-lg">
                  <strong className="text-yellow-900">✅ Observações Finais:</strong>
                  <ul className="list-disc list-inside ml-2 mt-2 space-y-1 text-yellow-800">
                    <li>A EC2 deve ter o <strong>SSM Agent ativo</strong>.</li>
                    <li>A instância precisa ter uma <strong>IAM Role</strong> com a policy: <code className="bg-yellow-200 px-2 py-1 rounded text-xs">arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore</code></li>
                    <li>A subnet da instância precisa de <strong>acesso à internet</strong> ou VPC endpoints para SSM.</li>
                    <li>Todas as instâncias criadas por este sistema já vêm <strong>configuradas automaticamente</strong> com SSM.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                
                {/* Enhanced SSM Information for EC2 */}
                <div className="mt-4 p-3 bg-orange-100 rounded-lg border-l-4 border-orange-500">
                  <div className="flex items-start space-x-2">
                    <Info className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium mb-2">📋 Informações importantes sobre acesso:</p>
                      {config.osType === 'windows' ? (
                        <div className="space-y-2">
                          <p>✅ <strong>Windows Server 2022</strong> com SSM habilitado automaticamente</p>
                          <p>🔑 <strong>Acesso via Session Manager:</strong> Não precisa de chaves SSH</p>
                          <p>🖥️ <strong>Acesso RDP:</strong> Via túnel SSM (veja instruções acima)</p>
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
                        ⚠️ Certifique-se de ter configurado as permissões IAM mencionadas acima antes de tentar conectar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Created Resources */}
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

      {/* Action Buttons */}
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

      {/* Deployment Logs */}
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
            <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {deploymentLogs}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AWSDeployment;
