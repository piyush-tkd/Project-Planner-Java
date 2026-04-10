/**
 * OnboardingWizard — 5-step full-screen modal for first-time organization setup
 * Step 1: Welcome + org name + logo
 * Step 2: Add team members
 * Step 3: Create a pod
 * Step 4: Connect Jira
 * Step 5: Create first project
 */
import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Select,
  Progress,
  Stepper,
  Grid,
  Paper,
  ActionIcon,
  useComputedColorScheme,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { AQUA, DEEP_BLUE } from '../../brandTokens';

interface Step {
  id: number;
  title: string;
  description: string;
  content: React.ReactNode;
}

interface TeamMember {
  name: string;
  role: string;
  email: string;
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const isDark = useComputedColorScheme() === 'dark';
  const [step, setStep] = useState(0);

  // Step 1: Welcome
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Step 2: Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: '', role: '', email: '' },
  ]);

  // Step 3: Pod
  const [podName, setPodName] = useState('');
  const [podLead, setPodLead] = useState('');
  const [podCapacity, setPodCapacity] = useState('');

  // Step 4: Jira
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraToken, setJiraToken] = useState('');

  // Step 5: Project
  const [projectName, setProjectName] = useState('');
  const [projectStatus, setProjectStatus] = useState('Planning');
  const [projectOwner, setProjectOwner] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const handleAddTeamMember = () => {
    setTeamMembers([...teamMembers, { name: '', role: '', email: '' }]);
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = [...teamMembers];
    updated[index][field] = value;
    setTeamMembers(updated);
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleComplete = () => {
    localStorage.setItem('pp_onboarding_complete', '1');
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('pp_onboarding_complete', '1');
    onComplete();
  };

  const teamMemberNames = teamMembers
    .filter(m => m.name.trim())
    .map(m => m.name);

  const steps: Step[] = [
    {
      id: 1,
      title: 'Welcome to Portfolio Planner',
      description: 'Let\'s set up your organization in a few quick steps',
      content: (
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb={8}>
              Organization Name
            </Text>
            <TextInput
              placeholder="e.g., Acme Corp"
              value={orgName}
              onChange={e => setOrgName(e.currentTarget.value)}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              Logo URL (Optional)
            </Text>
            <TextInput
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={e => setLogoUrl(e.currentTarget.value)}
            />
          </div>
        </Stack>
      ),
    },
    {
      id: 2,
      title: 'Add Your Team',
      description: 'Who are the key people in your organization?',
      content: (
        <Stack gap="md">
          {teamMembers.map((member, idx) => (
            <Paper key={idx} p="md" radius="md" style={{
              background: isDark ? 'rgba(45, 204, 211, 0.05)' : 'rgba(45, 204, 211, 0.03)',
              border: isDark ? '1px solid rgba(45, 204, 211, 0.1)' : '1px solid rgba(45, 204, 211, 0.15)',
            }}>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={600}>
                  Team Member {idx + 1}
                </Text>
                {idx > 0 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemoveTeamMember(idx)}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                )}
              </Group>
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    placeholder="Name"
                    value={member.name}
                    onChange={e => updateTeamMember(idx, 'name', e.currentTarget.value)}
                    size="sm"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    placeholder="Role"
                    value={member.role}
                    onChange={e => updateTeamMember(idx, 'role', e.currentTarget.value)}
                    size="sm"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    placeholder="Email"
                    type="email"
                    value={member.email}
                    onChange={e => updateTeamMember(idx, 'email', e.currentTarget.value)}
                    size="sm"
                  />
                </Grid.Col>
              </Grid>
            </Paper>
          ))}
          <Button
            variant="light"
            onClick={handleAddTeamMember}
            fullWidth
          >
            + Add Another Member
          </Button>
        </Stack>
      ),
    },
    {
      id: 3,
      title: 'Create Your First Pod',
      description: 'Pods help organize your team by function or project',
      content: (
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb={8}>
              Pod Name
            </Text>
            <TextInput
              placeholder="e.g., Backend Team"
              value={podName}
              onChange={e => setPodName(e.currentTarget.value)}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              Pod Lead
            </Text>
            <Select
              placeholder="Select a team member"
              value={podLead}
              onChange={v => setPodLead(v || '')}
              data={teamMemberNames}
              searchable
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              Capacity (in hours/week)
            </Text>
            <TextInput
              placeholder="e.g., 160"
              type="number"
              value={podCapacity}
              onChange={e => setPodCapacity(e.currentTarget.value)}
            />
          </div>
        </Stack>
      ),
    },
    {
      id: 4,
      title: 'Connect Jira',
      description: 'Sync your Jira data to see real-time issue tracking',
      content: (
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb={8}>
              Jira URL
            </Text>
            <TextInput
              placeholder="https://your-org.atlassian.net"
              value={jiraUrl}
              onChange={e => setJiraUrl(e.currentTarget.value)}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              API Token
            </Text>
            <TextInput
              placeholder="Your Jira API token"
              type="password"
              value={jiraToken}
              onChange={e => setJiraToken(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed" mt={6}>
              Get your token from Jira account settings
            </Text>
          </div>
          <Button
            variant="light"
            fullWidth
            onClick={handleSkip}
          >
            Skip for Now
          </Button>
        </Stack>
      ),
    },
    {
      id: 5,
      title: 'Create Your First Project',
      description: 'Let\'s set up your first project',
      content: (
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb={8}>
              Project Name
            </Text>
            <TextInput
              placeholder="e.g., Q2 2025 Launch"
              value={projectName}
              onChange={e => setProjectName(e.currentTarget.value)}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              Status
            </Text>
            <Select
              placeholder="Select status"
              value={projectStatus}
              onChange={v => setProjectStatus(v || 'Planning')}
              data={['Planning', 'In Progress', 'On Hold', 'Completed']}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              Project Owner
            </Text>
            <Select
              placeholder="Select owner"
              value={projectOwner}
              onChange={v => setProjectOwner(v || '')}
              data={teamMemberNames}
              searchable
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={8}>
              Target Date
            </Text>
            <TextInput
              placeholder="YYYY-MM-DD"
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.currentTarget.value)}
            />
          </div>
        </Stack>
      ),
    },
  ];

  return (
    <Modal
      opened={true}
      onClose={handleSkip}
      size="lg"
      centered
      withCloseButton={false}
      styles={{
        content: {
          background: isDark ? '#13131e' : '#ffffff',
        },
      }}
    >
      <Stack gap="md">
        {/* Progress Bar */}
        <Progress
          value={(step + 1) * 20}
          color={AQUA}
          size="md"
          radius="md"
        />

        {/* Stepper */}
        <Stepper
          active={step}
          orientation="horizontal"
          size="sm"
          style={{ marginBottom: 8 }}
        >
          {[1, 2, 3, 4, 5].map(s => (
            <Stepper.Step key={s} />
          ))}
        </Stepper>

        {/* Content */}
        <div>
          <Text size="lg" fw={700} mb={6}>
            {steps[step].title}
          </Text>
          <Text size="sm" c="dimmed" mb="xl">
            {steps[step].description}
          </Text>
          {steps[step].content}
        </div>

        {/* Buttons */}
        <Group justify="space-between" mt="xl">
          <Button
            variant="default"
            onClick={handleSkip}
            size="sm"
          >
            Skip Setup
          </Button>
          <Group gap="sm">
            {step > 0 && (
              <Button
                variant="default"
                onClick={handleBack}
                size="sm"
              >
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button
                onClick={handleNext}
                size="sm"
                style={{ background: AQUA }}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                size="sm"
                style={{ background: AQUA }}
              >
                Let's Go!
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

export default OnboardingWizard;
