import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Server, Play, Square, RotateCcw, Upload, Download, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SelectedResources {
  vpc: boolean;
  subnet: boolean;
  securityGroup: boolean;
  ec2: boolean;
  loadBalancer: boolean;
  internetGateway: boolean;
}

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerraform, setShowTerraform] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string>("");
  const [hasExecuted, setHasExecuted] = useState(false);
  
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({
    vpc: false,
    subnet: false,
    securityGroup: false,
    ec2: false,
    loadBalancer: false,
    internetGateway: false
  });

  const [config, setConfig] = useState({
    region: (awsAuth.credentials && 'region' in awsAuth.credentials) ? awsAuth.credentials.region : "us-east-1",
    vpcName: "vpc-production",
    vpcCidr: "10.0.0.0/16",
    subnetName: "public-subnet", 
    subnetCidr: "10.0.1.0/24",
    existingVpcId: "", // Para quando criar subnet sem VPC
    instanceType: "t2.micro",
    keyPair: "my-keypair",
    sgName: "web-security-group",
    existingSubnetId: "", // Para quando criar EC2 sem subnet
    existingSecurityGroupId: "" // Para quando criar EC2 sem security group
  });

  const handleResourceChange = (resource: keyof SelectedResources, checked: boolean) => {
    setSelectedResources(prev => ({ ...prev, [resource]: checked }));
  };

  const handleDeploy = async () => {
    if (!awsAuth.isAuthenticated) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa fazer login na AWS primeiro.",
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
    setHasExecuted(true);
    setDeploymentLogs("");
    
    toast({
      title: "Deployment Iniciado",
      description: `Executando Terraform para ${selectedCount} recurso(s) selecionado(s).`,
    });
    
    console.log("Deploying resources:", selectedResources, config);
    
    // Simular execução do Terraform com logs em tempo real
    const logMessages = [
      "> terraform init",
      "Initializing the backend...",
      "Initializing provider plugins...",
      "- Finding hashicorp/aws versions matching \"5.42.0\"...",
      "- Installing hashicorp/aws v5.42.0...",
      "- Installed hashicorp/aws v5.42.0",
      "",
      "Terraform has been successfully initialized!",
      "",
      "> terraform plan",
      "Terraform used the selected providers to generate the following execution plan.",
      "Resource actions are indicated with the following symbols:",
      "  + create",
      "",
      "Terraform will perform the following actions:",
      ...Object.entries(selectedResources).filter(([, selected]) => selected).map(([key]) => 
        `  # aws_${key}.main will be created\n  + resource "aws_${key}" "main" {\n      + arn = (known after apply)\n      + id  = (known after apply)\n    }`
      ),
      "",
      `Plan: ${Object.values(selectedResources).filter(Boolean).length} to add, 0 to change, 0 to destroy.`,
      "",
      "> terraform apply --auto-approve",
      "aws_vpc.main: Creating...",
      "aws_vpc.main: Creation complete after 2s [id=vpc-0123456789abcdef0]",
      ...Object.entries(selectedResources).filter(([, selected]) => selected).slice(1).map(([key], index) => 
        `aws_${key}.main: Creating...\naws_${key}.main: Creation complete after ${Math.floor(Math.random() * 30) + 10}s [id=${key}-${Math.random().toString(36).substr(2, 9)}]`
      ),
      "",
      `Apply complete! Resources: ${Object.values(selectedResources).filter(Boolean).length} added, 0 changed, 0 destroyed.`,
      "",
      "Outputs:",
      "",
      selectedResources.vpc ? "vpc_id = \"vpc-0123456789abcdef0\"" : "",
      selectedResources.subnet ? "subnet_id = \"subnet-0123456789abcdef0\"" : "",
      selectedResources.ec2 ? "instance_id = \"i-0123456789abcdef0\"" : "",
      selectedResources.securityGroup ? "security_group_id = \"sg-0123456789abcdef0\"" : "",
    ].filter(Boolean);

    // Simular logs em tempo real
    for (let i = 0; i < logMessages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setDeploymentLogs(prev => prev + logMessages[i] + "\n");
    }
    
    setTimeout(() => {
      setIsDeploying(false);
      toast({
        title: "Deployment Completo",
        description: "Recursos AWS foram criados com sucesso.",
      });
    }, 1000);
  };

  const generateTerraformCode = () => {
    const awsCredentials = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials : null;
    
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
  access_key = "${awsCredentials?.accessKey || ''}"
  secret_key = "${awsCredentials?.secretKey || ''}"
  ${awsCredentials?.token ? `token = "${awsCredentials.token}"` : ''}
}

`;

    // VPC
    if (selectedResources.vpc) {
      terraformCode += `resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  tags = {
    Name = "${config.vpcName}"
  }
}

`;
    }

    // Internet Gateway (depende da VPC)
    if (selectedResources.internetGateway) {
      if (selectedResources.vpc) {
        terraformCode += `resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "main-igw"
  }
}

`;
      } else {
        terraformCode += `resource "aws_internet_gateway" "main" {
  vpc_id = "${config.existingVpcId}"
  tags = {
    Name = "main-igw"
  }
}

`;
      }
    }

    // Subnet
    if (selectedResources.subnet) {
      if (selectedResources.vpc) {
        terraformCode += `resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "${config.subnetCidr}"
  tags = {
    Name = "${config.subnetName}"
  }
}

`;
      } else {
        terraformCode += `resource "aws_subnet" "public" {
  vpc_id     = "${config.existingVpcId}"
  cidr_block = "${config.subnetCidr}"
  tags = {
    Name = "${config.subnetName}"
  }
}

`;
      }
    }

    // Security Group
    if (selectedResources.securityGroup) {
      const vpcReference = selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`;
      terraformCode += `resource "aws_security_group" "web" {
  name        = "${config.sgName}"
  description = "Security group for web servers"
  vpc_id      = ${vpcReference}

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${config.sgName}"
  }
}

`;
    }

    // EC2 Instance
    if (selectedResources.ec2) {
      let subnetRef = '';
      let securityGroupRef = '';
      
      if (selectedResources.subnet) {
        subnetRef = 'subnet_id     = aws_subnet.public.id';
      } else if (config.existingSubnetId) {
        subnetRef = `subnet_id     = "${config.existingSubnetId}"`;
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
    { key: 'subnet' as keyof SelectedResources, name: 'Subnet', description: 'Sub-rede dentro da VPC' },
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
            
            {/* VPC Configuration */}
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

            {/* Subnet Configuration */}
            {selectedResources.subnet && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Configuração Subnet</h4>
                <div>
                  <Label htmlFor="subnetName">Nome da Subnet</Label>
                  <Input
                    id="subnetName"
                    value={config.subnetName}
                    onChange={(e) => setConfig({ ...config, subnetName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="subnetCidr">CIDR Block</Label>
                  <Input
                    id="subnetCidr"
                    value={config.subnetCidr}
                    onChange={(e) => setConfig({ ...config, subnetCidr: e.target.value })}
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

            {/* Security Group Configuration */}
            {selectedResources.securityGroup && (
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">Configuração Security Group</h4>
                <div>
                  <Label htmlFor="sgName">Nome do Security Group</Label>
                  <Input
                    id="sgName"
                    value={config.sgName}
                    onChange={(e) => setConfig({ ...config, sgName: e.target.value })}
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="existingVpcIdSg">ID da VPC Existente</Label>
                    <Input
                      id="existingVpcIdSg"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            {/* EC2 Configuration */}
            {selectedResources.ec2 && (
              <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900">Configuração EC2</h4>
                <div>
                  <Label htmlFor="keyPair">Key Pair Name</Label>
                  <Input
                    id="keyPair"
                    value={config.keyPair}
                    onChange={(e) => setConfig({ ...config, keyPair: e.target.value })}
                  />
                </div>
                {!selectedResources.subnet && (
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
                    Executando Terraform...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Deploy Infrastructure
                  </>
                )}
              </Button>
              <Button variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop
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
            <CardTitle>Código Terraform Gerado</CardTitle>
            <CardDescription>
              Código que será executado baseado na sua seleção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {generateTerraformCode()}
              </pre>
            </div>
            <div className="flex space-x-2 mt-4">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload .tf File
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
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
                    <span className="text-sm text-blue-600">Executando...</span>
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
              Saída do comando: terraform apply --auto-approve
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
