import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cloud, Server, Shield, Database, Plus, Trash2, Key } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface SecurityGroupRule {
  type: 'ingress' | 'egress';
  protocol: string;
  fromPort: string;
  toPort: string;
  cidrBlocks: string;
  description: string;
}

interface FormData {
  resourceType: string;
  vpcName: string;
  vpcCidr: string;
  internetGatewayVpc: string;
  publicSubnetVpc: string;
  publicSubnetName: string;
  publicSubnetCidr: string;
  privateSubnetVpc: string;
  privateSubnetName: string;
  privateSubnetCidr: string;
  keyPairName: string;
  ec2SubnetId: string;
  ec2SecurityGroup: string;
  ec2InstanceType: string;
  ec2ImageId: string;
  ec2InstanceName: string;
  ec2DiskSize: string;
  securityGroupName: string;
  securityGroupDescription: string;
  securityGroupVpc: string;
  securityGroupRules: SecurityGroupRule[];
  loadBalancerName: string;
  loadBalancerType: string;
  loadBalancerSubnets: string[];
  loadBalancerSecurityGroups: string[];
}

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [availableVpcs, setAvailableVpcs] = useState<Array<{id: string, name: string}>>([]);
  const [availableSubnets, setAvailableSubnets] = useState<Array<{id: string, name: string, vpcId: string}>>([]);
  const [availableSecurityGroups, setAvailableSecurityGroups] = useState<Array<{id: string, name: string}>>([]);
  const [formData, setFormData] = useState<FormData>({
    resourceType: '',
    vpcName: '',
    vpcCidr: '',
    internetGatewayVpc: '',
    publicSubnetVpc: '',
    publicSubnetName: '',
    publicSubnetCidr: '',
    privateSubnetVpc: '',
    privateSubnetName: '',
    privateSubnetCidr: '',
    keyPairName: '',
    ec2SubnetId: '',
    ec2SecurityGroup: '',
    ec2InstanceType: 't2.micro',
    ec2ImageId: 'ami-0c55b159cbfafe1d0',
    ec2InstanceName: '',
    ec2DiskSize: '8',
    securityGroupName: '',
    securityGroupDescription: '',
    securityGroupVpc: '',
    securityGroupRules: [],
    loadBalancerName: '',
    loadBalancerType: 'application',
    loadBalancerSubnets: [],
    loadBalancerSecurityGroups: []
  });

  const deployToAWS = async () => {
    if (!formData.resourceType) {
      toast({
        title: "Erro",
        description: "Selecione um tipo de recurso para fazer o deploy",
        variant: "destructive",
      });
      return;
    }

    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado na AWS para fazer o deploy",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;

      console.log('🚀 Iniciando deployment AWS...');
      
      const response = await fetch(`${backendUrl}/api/aws/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          resourceType: formData.resourceType,
          formData: formData,
          region: awsAuth.credentials.region || 'us-east-1'
        }),
      });

      const responseText = await response.text();
      console.log('📥 Response recebida:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Erro ao parsear JSON:', e);
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 200)}...`);
      }

      // Verificar se houve sucesso baseado na presença de logs de sucesso
      const hasSuccessLogs = responseText.includes('Apply complete!') || 
                            responseText.includes('Creation complete') ||
                            result.success === true;

      if (response.ok && hasSuccessLogs) {
        console.log('✅ Deploy realizado com sucesso!');
        toast({
          title: "Deploy realizado com sucesso!",
          description: `${formData.resourceType} foi criado com sucesso na AWS`,
        });

        // Extrair o ID do recurso dos logs
        const resourceId = extractResourceIdFromLogs(responseText, formData.resourceType);
        if (resourceId) {
          await saveCreatedResource(resourceId, formData.resourceType, formData);
        }

        // Reset form
        setFormData({
          resourceType: '',
          vpcName: '',
          vpcCidr: '',
          internetGatewayVpc: '',
          publicSubnetVpc: '',
          publicSubnetName: '',
          publicSubnetCidr: '',
          privateSubnetVpc: '',
          privateSubnetName: '',
          privateSubnetCidr: '',
          keyPairName: '',
          ec2SubnetId: '',
          ec2SecurityGroup: '',
          ec2InstanceType: 't2.micro',
          ec2ImageId: 'ami-0c55b159cbfafe1d0',
          ec2InstanceName: '',
          ec2DiskSize: '8',
          securityGroupName: '',
          securityGroupDescription: '',
          securityGroupVpc: '',
          securityGroupRules: [],
          loadBalancerName: '',
          loadBalancerType: 'application',
          loadBalancerSubnets: [],
          loadBalancerSecurityGroups: []
        });
      } else {
        console.error('❌ Erro no deploy:', result);
        const errorMessage = result.error || result.message || 'Erro desconhecido no deployment';
        toast({
          title: "Erro no deployment",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Erro durante o deployment:', error);
      toast({
        title: "Erro no deployment",
        description: error instanceof Error ? error.message : "Erro desconhecido durante o deployment",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Função para extrair ID do recurso dos logs
  const extractResourceIdFromLogs = (logs: string, resourceType: string): string | null => {
    console.log('🔍 Extraindo ID do recurso dos logs:', { resourceType, logs: logs.substring(0, 500) });
    
    try {
      if (resourceType === 'vpc') {
        const vpcMatch = logs.match(/\[id=vpc-([a-f0-9]+)\]/);
        if (vpcMatch) {
          const fullId = `vpc-${vpcMatch[1]}`;
          console.log('✅ VPC ID extraído:', fullId);
          return fullId;
        }
      }
      // Adicionar outros tipos de recursos aqui conforme necessário
    } catch (error) {
      console.error('❌ Erro ao extrair ID:', error);
    }
    
    return null;
  };

  // Função para salvar recurso criado
  const saveCreatedResource = async (resourceId: string, resourceType: string, formData: any) => {
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : null;

      if (!userId) return;

      console.log('💾 Salvando recurso criado:', { resourceId, resourceType });

      const resourceData = {
        id: resourceId,
        type: resourceType,
        name: getResourceName(resourceType, formData),
        status: 'running',
        region: awsAuth.credentials && 'region' in awsAuth.credentials ? awsAuth.credentials.region : 'us-east-1',
        createdAt: new Date().toISOString(),
        details: getResourceDetails(resourceType, formData)
      };

      const response = await fetch(`${backendUrl}/api/aws/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          resource: resourceData
        }),
      });

      if (response.ok) {
        console.log('✅ Recurso salvo com sucesso');
      } else {
        console.error('❌ Erro ao salvar recurso:', response.status);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar recurso:', error);
    }
  };

  // Função para obter nome do recurso
  const getResourceName = (resourceType: string, formData: any): string => {
    switch (resourceType) {
      case 'vpc':
        return formData.vpcName || 'VPC sem nome';
      case 'internet-gateway':
        return formData.internetGatewayVpc || 'Internet Gateway';
      case 'public-subnet':
        return formData.publicSubnetName || 'Subnet Pública';
      case 'private-subnet':
        return formData.privateSubnetName || 'Subnet Privada';
      case 'ec2':
        return formData.ec2InstanceName || 'Instância EC2';
      case 'security-group':
        return formData.securityGroupName || 'Security Group';
      case 'load-balancer':
        return formData.loadBalancerName || 'Load Balancer';
      default:
        return resourceType;
    }
  };

  // Função para obter detalhes do recurso
  const getResourceDetails = (resourceType: string, formData: any): any => {
    const baseDetails = {
      created_via: 'terraform',
      deployment_time: new Date().toISOString()
    };

    switch (resourceType) {
      case 'vpc':
        return {
          ...baseDetails,
          cidr_block: formData.vpcCidr,
          enable_dns_support: true,
          enable_dns_hostnames: true
        };
      case 'ec2':
        return {
          ...baseDetails,
          instance_type: formData.ec2InstanceType,
          image_id: formData.ec2ImageId,
          subnet_id: formData.ec2SubnetId,
          security_group_id: formData.ec2SecurityGroup,
          disk_size: formData.ec2DiskSize
        };
      case 'public-subnet':
      case 'private-subnet':
        return {
          ...baseDetails,
          cidr_block: resourceType === 'public-subnet' ? formData.publicSubnetCidr : formData.privateSubnetCidr,
          vpc_id: resourceType === 'public-subnet' ? formData.publicSubnetVpc : formData.privateSubnetVpc,
          map_public_ip_on_launch: resourceType === 'public-subnet'
        };
      default:
        return baseDetails;
    }
  };

  const createKeyPair = async () => {
    if (!formData.keyPairName.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para o Key Pair",
        variant: "destructive",
      });
      return;
    }

    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado na AWS",
        variant: "destructive",
      });
      return;
    }

    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;

      const response = await fetch(`${backendUrl}/api/aws/create-keypair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          keyPairName: formData.keyPairName,
          region: awsAuth.credentials.region || 'us-east-1'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Download the private key
        const blob = new Blob([result.privateKey], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formData.keyPairName}.pem`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Key Pair criado com sucesso!",
          description: `${formData.keyPairName} foi criado e a chave privada foi baixada`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar Key Pair');
      }
    } catch (error) {
      console.error('Erro ao criar Key Pair:', error);
      toast({
        title: "Erro ao criar Key Pair",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const loadAvailableResources = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      return;
    }

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
        
        const vpcs = resources.filter((r: any) => r.type === 'vpc').map((r: any) => ({
          id: r.id,
          name: r.name
        }));
        
        const subnets = resources.filter((r: any) => r.type === 'public-subnet' || r.type === 'private-subnet').map((r: any) => ({
          id: r.id,
          name: r.name,
          vpcId: r.details?.vpc_id || ''
        }));
        
        const securityGroups = resources.filter((r: any) => r.type === 'security-group').map((r: any) => ({
          id: r.id,
          name: r.name
        }));
        
        setAvailableVpcs(vpcs);
        setAvailableSubnets(subnets);
        setAvailableSecurityGroups(securityGroups);
      }
    } catch (error) {
      console.error('Erro ao carregar recursos:', error);
    }
  };

  useEffect(() => {
    loadAvailableResources();
  }, [awsAuth.isAuthenticated]);

  const addSecurityGroupRule = () => {
    setFormData(prev => ({
      ...prev,
      securityGroupRules: [...prev.securityGroupRules, {
        type: 'ingress',
        protocol: 'tcp',
        fromPort: '80',
        toPort: '80',
        cidrBlocks: '0.0.0.0/0',
        description: ''
      }]
    }));
  };

  const removeSecurityGroupRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      securityGroupRules: prev.securityGroupRules.filter((_, i) => i !== index)
    }));
  };

  const updateSecurityGroupRule = (index: number, field: keyof SecurityGroupRule, value: string) => {
    setFormData(prev => ({
      ...prev,
      securityGroupRules: prev.securityGroupRules.map((rule, i) => 
        i === index ? { ...rule, [field]: value } : rule
      )
    }));
  };

  const renderResourceForm = () => {
    switch (formData.resourceType) {
      case 'vpc':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="vpcName">Nome da VPC</Label>
              <Input
                id="vpcName"
                value={formData.vpcName}
                onChange={(e) => setFormData(prev => ({ ...prev, vpcName: e.target.value }))}
                placeholder="Ex: minha-vpc-producao"
              />
            </div>
            <div>
              <Label htmlFor="vpcCidr">CIDR Block</Label>
              <Input
                id="vpcCidr"
                value={formData.vpcCidr}
                onChange={(e) => setFormData(prev => ({ ...prev, vpcCidr: e.target.value }))}
                placeholder="Ex: 10.0.0.0/16"
              />
            </div>
          </div>
        );

      case 'internet-gateway':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="internetGatewayVpc">VPC para anexar o Internet Gateway</Label>
              <Select value={formData.internetGatewayVpc} onValueChange={(value) => setFormData(prev => ({ ...prev, internetGatewayVpc: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma VPC" />
                </SelectTrigger>
                <SelectContent>
                  {availableVpcs.map(vpc => (
                    <SelectItem key={vpc.id} value={vpc.id}>
                      {vpc.name} ({vpc.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'public-subnet':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="publicSubnetVpc">VPC</Label>
              <Select value={formData.publicSubnetVpc} onValueChange={(value) => setFormData(prev => ({ ...prev, publicSubnetVpc: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma VPC" />
                </SelectTrigger>
                <SelectContent>
                  {availableVpcs.map(vpc => (
                    <SelectItem key={vpc.id} value={vpc.id}>
                      {vpc.name} ({vpc.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="publicSubnetName">Nome da Subnet</Label>
              <Input
                id="publicSubnetName"
                value={formData.publicSubnetName}
                onChange={(e) => setFormData(prev => ({ ...prev, publicSubnetName: e.target.value }))}
                placeholder="Ex: subnet-publica-1"
              />
            </div>
            <div>
              <Label htmlFor="publicSubnetCidr">CIDR Block</Label>
              <Input
                id="publicSubnetCidr"
                value={formData.publicSubnetCidr}
                onChange={(e) => setFormData(prev => ({ ...prev, publicSubnetCidr: e.target.value }))}
                placeholder="Ex: 10.0.1.0/24"
              />
            </div>
          </div>
        );

      case 'private-subnet':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="privateSubnetVpc">VPC</Label>
              <Select value={formData.privateSubnetVpc} onValueChange={(value) => setFormData(prev => ({ ...prev, privateSubnetVpc: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma VPC" />
                </SelectTrigger>
                <SelectContent>
                  {availableVpcs.map(vpc => (
                    <SelectItem key={vpc.id} value={vpc.id}>
                      {vpc.name} ({vpc.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="privateSubnetName">Nome da Subnet</Label>
              <Input
                id="privateSubnetName"
                value={formData.privateSubnetName}
                onChange={(e) => setFormData(prev => ({ ...prev, privateSubnetName: e.target.value }))}
                placeholder="Ex: subnet-privada-1"
              />
            </div>
            <div>
              <Label htmlFor="privateSubnetCidr">CIDR Block</Label>
              <Input
                id="privateSubnetCidr"
                value={formData.privateSubnetCidr}
                onChange={(e) => setFormData(prev => ({ ...prev, privateSubnetCidr: e.target.value }))}
                placeholder="Ex: 10.0.2.0/24"
              />
            </div>
          </div>
        );

      case 'key-pair':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="keyPairName">Nome do Key Pair</Label>
              <Input
                id="keyPairName"
                value={formData.keyPairName}
                onChange={(e) => setFormData(prev => ({ ...prev, keyPairName: e.target.value }))}
                placeholder="Ex: minha-chave-ec2"
              />
            </div>
            <Button 
              type="button" 
              onClick={createKeyPair}
              className="w-full"
              variant="outline"
            >
              <Key className="h-4 w-4 mr-2" />
              Criar Key Pair e Baixar Chave Privada
            </Button>
          </div>
        );

      case 'ec2':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ec2InstanceName">Nome da Instância</Label>
              <Input
                id="ec2InstanceName"
                value={formData.ec2InstanceName}
                onChange={(e) => setFormData(prev => ({ ...prev, ec2InstanceName: e.target.value }))}
                placeholder="Ex: servidor-web"
              />
            </div>
            <div>
              <Label htmlFor="ec2SubnetId">Subnet</Label>
              <Select value={formData.ec2SubnetId} onValueChange={(value) => setFormData(prev => ({ ...prev, ec2SubnetId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subnet" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubnets.map(subnet => (
                    <SelectItem key={subnet.id} value={subnet.id}>
                      {subnet.name} ({subnet.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ec2SecurityGroup">Security Group</Label>
              <Select value={formData.ec2SecurityGroup} onValueChange={(value) => setFormData(prev => ({ ...prev, ec2SecurityGroup: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um security group" />
                </SelectTrigger>
                <SelectContent>
                  {availableSecurityGroups.map(sg => (
                    <SelectItem key={sg.id} value={sg.id}>
                      {sg.name} ({sg.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ec2InstanceType">Tipo da Instância</Label>
              <Select value={formData.ec2InstanceType} onValueChange={(value) => setFormData(prev => ({ ...prev, ec2InstanceType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t2.micro">t2.micro (1 vCPU, 1 GB RAM)</SelectItem>
                  <SelectItem value="t2.small">t2.small (1 vCPU, 2 GB RAM)</SelectItem>
                  <SelectItem value="t2.medium">t2.medium (2 vCPU, 4 GB RAM)</SelectItem>
                  <SelectItem value="t3.micro">t3.micro (2 vCPU, 1 GB RAM)</SelectItem>
                  <SelectItem value="t3.small">t3.small (2 vCPU, 2 GB RAM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ec2ImageId">AMI ID</Label>
              <Input
                id="ec2ImageId"
                value={formData.ec2ImageId}
                onChange={(e) => setFormData(prev => ({ ...prev, ec2ImageId: e.target.value }))}
                placeholder="Ex: ami-0c55b159cbfafe1d0"
              />
            </div>
            <div>
              <Label htmlFor="ec2DiskSize">Tamanho do Disco (GB)</Label>
              <Input
                id="ec2DiskSize"
                type="number"
                value={formData.ec2DiskSize}
                onChange={(e) => setFormData(prev => ({ ...prev, ec2DiskSize: e.target.value }))}
                placeholder="8"
              />
            </div>
          </div>
        );

      case 'security-group':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="securityGroupName">Nome do Security Group</Label>
              <Input
                id="securityGroupName"
                value={formData.securityGroupName}
                onChange={(e) => setFormData(prev => ({ ...prev, securityGroupName: e.target.value }))}
                placeholder="Ex: web-server-sg"
              />
            </div>
            <div>
              <Label htmlFor="securityGroupDescription">Descrição</Label>
              <Input
                id="securityGroupDescription"
                value={formData.securityGroupDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, securityGroupDescription: e.target.value }))}
                placeholder="Ex: Security group para servidores web"
              />
            </div>
            <div>
              <Label htmlFor="securityGroupVpc">VPC</Label>
              <Select value={formData.securityGroupVpc} onValueChange={(value) => setFormData(prev => ({ ...prev, securityGroupVpc: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma VPC" />
                </SelectTrigger>
                <SelectContent>
                  {availableVpcs.map(vpc => (
                    <SelectItem key={vpc.id} value={vpc.id}>
                      {vpc.name} ({vpc.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Regras de Segurança</Label>
                <Button type="button" onClick={addSecurityGroupRule} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Regra
                </Button>
              </div>
              
              <ScrollArea className="h-64 border rounded-md p-4">
                {formData.securityGroupRules.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma regra adicionada</p>
                ) : (
                  <div className="space-y-4">
                    {formData.securityGroupRules.map((rule, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={rule.type === 'ingress' ? 'default' : 'secondary'}>
                            {rule.type === 'ingress' ? 'Entrada' : 'Saída'}
                          </Badge>
                          <Button
                            type="button"
                            onClick={() => removeSecurityGroupRule(index)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select 
                              value={rule.type} 
                              onValueChange={(value: 'ingress' | 'egress') => updateSecurityGroupRule(index, 'type', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ingress">Entrada</SelectItem>
                                <SelectItem value="egress">Saída</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Protocolo</Label>
                            <Select 
                              value={rule.protocol} 
                              onValueChange={(value) => updateSecurityGroupRule(index, 'protocol', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tcp">TCP</SelectItem>
                                <SelectItem value="udp">UDP</SelectItem>
                                <SelectItem value="icmp">ICMP</SelectItem>
                                <SelectItem value="-1">All</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Porta Inicial</Label>
                            <Input
                              type="number"
                              value={rule.fromPort}
                              onChange={(e) => updateSecurityGroupRule(index, 'fromPort', e.target.value)}
                              className="h-8"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs">Porta Final</Label>
                            <Input
                              type="number"
                              value={rule.toPort}
                              onChange={(e) => updateSecurityGroupRule(index, 'toPort', e.target.value)}
                              className="h-8"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs">CIDR Blocks</Label>
                          <Input
                            value={rule.cidrBlocks}
                            onChange={(e) => updateSecurityGroupRule(index, 'cidrBlocks', e.target.value)}
                            placeholder="Ex: 0.0.0.0/0"
                            className="h-8"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-xs">Descrição</Label>
                          <Input
                            value={rule.description}
                            onChange={(e) => updateSecurityGroupRule(index, 'description', e.target.value)}
                            placeholder="Opcional"
                            className="h-8"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        );

      case 'load-balancer':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="loadBalancerName">Nome do Load Balancer</Label>
              <Input
                id="loadBalancerName"
                value={formData.loadBalancerName}
                onChange={(e) => setFormData(prev => ({ ...prev, loadBalancerName: e.target.value }))}
                placeholder="Ex: web-app-lb"
              />
            </div>
            <div>
              <Label htmlFor="loadBalancerType">Tipo</Label>
              <Select value={formData.loadBalancerType} onValueChange={(value) => setFormData(prev => ({ ...prev, loadBalancerType: value }))}>
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center space-x-2">
            <Cloud className="h-6 w-6" />
            <span>AWS Deployment</span>
          </CardTitle>
          <CardDescription className="text-orange-100">
            Deploy recursos na Amazon Web Services
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <Label htmlFor="resourceType">Tipo de Recurso</Label>
              <Select value={formData.resourceType} onValueChange={(value) => setFormData(prev => ({ ...prev, resourceType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de recurso para criar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vpc">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4" />
                      <span>VPC (Virtual Private Cloud)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="internet-gateway">
                    <div className="flex items-center space-x-2">
                      <Cloud className="h-4 w-4" />
                      <span>Internet Gateway</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="public-subnet">
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4" />
                      <span>Public Subnet</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="private-subnet">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4" />
                      <span>Private Subnet</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="key-pair">
                    <div className="flex items-center space-x-2">
                      <Key className="h-4 w-4" />
                      <span>Key Pair</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ec2">
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4" />
                      <span>EC2 Instance</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="security-group">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4" />
                      <span>Security Group</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="load-balancer">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4" />
                      <span>Load Balancer</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.resourceType && (
              <>
                <Separator />
                {renderResourceForm()}
              </>
            )}

            <Button 
              onClick={deployToAWS}
              disabled={isDeploying || !formData.resourceType}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {isDeploying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Fazendo Deploy...
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 mr-2" />
                  Deploy na AWS
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AWSDeployment;
