
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface SSMInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  osType: 'linux' | 'windows';
  instanceId?: string;
}

const SSMInstructionsModal = ({ isOpen, onClose, osType, instanceId }: SSMInstructionsModalProps) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Comando copiado para a área de transferência",
    });
  };

  const connectCommand = instanceId 
    ? `aws ssm start-session --target ${instanceId}`
    : `aws ssm start-session --target <INSTANCE_ID>`;

  const rdpCommand = instanceId
    ? `aws ssm start-session --target ${instanceId} --document-name AWS-StartPortForwardingSession --parameters '{"portNumber":["3389"],"localPortNumber":["13389"]}'`
    : `aws ssm start-session --target <INSTANCE_ID> --document-name AWS-StartPortForwardingSession --parameters '{"portNumber":["3389"],"localPortNumber":["13389"]}'`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Info className="h-6 w-6 text-blue-600" />
            <span>🔐 Acessando EC2 via SSM — Passo a Passo ({osType === 'linux' ? 'Linux' : 'Windows'})</span>
          </DialogTitle>
          <DialogDescription>
            Instruções completas para acessar sua instância EC2 via AWS Session Manager
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pré-requisitos */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-blue-900 mb-3">☁️ Pré-requisitos:</h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-blue-800">
                <li>
                  <strong>AWS CLI instalada</strong> → 
                  <a href="https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html" 
                     className="underline text-blue-700 ml-1" target="_blank" rel="noopener noreferrer">
                    Link oficial
                  </a>
                </li>
                <li>
                  <strong>Session Manager Plugin instalado</strong> → 
                  <a href="https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html" 
                     className="underline text-blue-700 ml-1" target="_blank" rel="noopener noreferrer">
                    Link oficial
                  </a>
                </li>
                <li><strong>Autenticação configurada:</strong> <code className="bg-blue-200 px-2 py-1 rounded">aws configure</code></li>
              </ul>
            </CardContent>
          </Card>

          {/* Permissões IAM */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-yellow-900 mb-3">🔑 Seu usuário IAM precisa de permissões SSM:</h4>
              <div className="bg-yellow-100 p-3 rounded relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(`{
  "Effect": "Allow",
  "Action": [
    "ssm:StartSession",
    "ssm:DescribeInstanceInformation",
    "ssm:DescribeSessions",
    "ssm:TerminateSession"
  ],
  "Resource": "*"
}`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <pre className="text-xs text-yellow-900 overflow-x-auto pr-16">
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
            </CardContent>
          </Card>

          {/* Comandos específicos por OS */}
          {osType === 'linux' ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <h4 className="font-semibold text-green-900 mb-3">🐧 Conectar em EC2 Linux via SSM:</h4>
                <div className="bg-green-100 p-3 rounded relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(connectCommand)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <code className="text-sm text-green-900 block pr-16">{connectCommand}</code>
                </div>
                <p className="text-sm mt-2 text-green-800">
                  <strong>Resultado esperado:</strong> <code className="bg-green-200 px-2 py-1 rounded">[ec2-user@ip-10-0-0-123 ~]$</code>
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-purple-900 mb-3">🪟 Conectar em EC2 Windows via SSM (terminal):</h4>
                  <div className="bg-purple-100 p-3 rounded relative">
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(connectCommand)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <code className="text-sm text-purple-900 block pr-16">{connectCommand}</code>
                  </div>
                  <p className="text-sm mt-2 text-purple-800">
                    <strong>Resultado esperado:</strong> <code className="bg-purple-200 px-2 py-1 rounded">C:\Users\Administrator&gt;</code>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-indigo-900 mb-3">🖥️ (Opcional) Acessar Windows com RDP via túnel SSM:</h4>
                  <div className="bg-indigo-100 p-3 rounded relative">
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(rdpCommand)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <code className="text-xs text-indigo-900 block pr-16 overflow-x-auto whitespace-pre-wrap">
                      {rdpCommand}
                    </code>
                  </div>
                  <p className="text-sm mt-2 text-indigo-800">
                    Em seguida, abra o <strong>Remote Desktop (mstsc)</strong> e conecte em: <code className="bg-indigo-200 px-2 py-1 rounded">localhost:13389</code>
                  </p>
                  <p className="text-sm mt-1 text-indigo-800 font-medium">
                    🔐 Você acessa via túnel seguro, sem IP público nem abrir portas na instância.
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Observações Finais */}
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 mb-3">✅ Observações Finais:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-800">
                <li>A EC2 deve ter o <strong>SSM Agent ativo</strong>.</li>
                <li>A instância precisa ter uma <strong>IAM Role</strong> com a policy: <code className="bg-gray-200 px-2 py-1 rounded text-xs">arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore</code></li>
                <li>A subnet da instância precisa de <strong>acesso à internet</strong> ou VPC endpoints para SSM.</li>
                <li>Todas as instâncias criadas por este sistema já vêm <strong>configuradas automaticamente</strong> com SSM.</li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SSMInstructionsModal;
