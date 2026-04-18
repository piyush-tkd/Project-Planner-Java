import { useNavigate } from 'react-router-dom';
import {
  SimpleGrid,
  Card,
  Text,
  Title,
  Group,
  ThemeIcon,
  Container,
  Box,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBuilding,
  IconUsers,
  IconTicket,
  IconMail,
  IconWebhook,
  IconCalendar,
  IconCoin,
  IconAdjustments,
  IconBrandAzure,
  IconBrain,
  IconShield,
  IconDatabase,
  IconArrowRight,
} from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, DEEP_BLUE_TINTS, BORDER_DEFAULT } from '../../brandTokens';

interface SettingCategory {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const CATEGORIES: SettingCategory[] = [
  {
    title: 'Organisation',
    description: 'Branding, org name, fiscal year, system defaults',
    icon: <IconBuilding size={24} />,
    path: '/settings/org',
    color: AQUA,
  },
  {
    title: 'Users & Roles',
    description: 'Manage user accounts, roles, and access permissions',
    icon: <IconUsers size={24} />,
    path: '/settings/users',
    color: AQUA,
  },
  {
    title: 'Jira Integration',
    description: 'API credentials, board sync, resource and release mapping',
    icon: <IconTicket size={24} />,
    path: '/settings/jira',
    color: AQUA,
  },
  {
    title: 'Email & Notifications',
    description: 'Email templates, notification preferences, quiet hours',
    icon: <IconMail size={24} />,
    path: '/settings/email-templates',
    color: AQUA,
  },
  {
    title: 'Webhooks',
    description: 'Outbound webhooks with HMAC signing, delivery logs',
    icon: <IconWebhook size={24} />,
    path: '/settings/webhooks',
    color: AQUA,
  },
  {
    title: 'Scheduled Reports',
    description: 'Automated PDF/CSV/Excel report delivery',
    icon: <IconCalendar size={24} />,
    path: '/settings/scheduled-reports',
    color: AQUA,
  },
  {
    title: 'Cost Rates',
    description: 'Role-based cost rate cards and team cost modeller',
    icon: <IconCoin size={24} />,
    path: '/settings/cost-rates',
    color: AQUA,
  },
  {
    title: 'Custom Fields',
    description: 'Add custom metadata fields to projects',
    icon: <IconAdjustments size={24} />,
    path: '/settings/custom-fields',
    color: AQUA,
  },
  {
    title: 'Azure DevOps',
    description: 'Connect Azure DevOps for Git Intelligence metrics',
    icon: <IconBrandAzure size={24} />,
    path: '/settings/azure-devops',
    color: AQUA,
  },
  {
    title: 'AI & NLP',
    description: 'NLP model settings, smart mapping, AI optimizer',
    icon: <IconBrain size={24} />,
    path: '/settings/nlp',
    color: AQUA,
  },
  {
    title: 'Audit Log',
    description: 'Track who changed what, when',
    icon: <IconShield size={24} />,
    path: '/settings/audit-log',
    color: AQUA,
  },
  {
    title: 'Reference Data',
    description: 'Manage lookup tables and dropdown values',
    icon: <IconDatabase size={24} />,
    path: '/settings/ref-data',
    color: AQUA,
  },
];

function SettingCard({ category }: { category: SettingCategory }) {
  const navigate = useNavigate();

  return (
    <UnstyledButton onClick={() => navigate(category.path)}>
      <Card
        p="lg"
        radius="md"
        withBorder
        style={{
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          borderColor: BORDER_DEFAULT,
          borderWidth: 1,
        }}
        className="hover-card"
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = `0 4px 12px rgba(45, 204, 211, 0.15)`;
          el.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = 'none';
          el.style.transform = 'translateY(0)';
        }}
      >
        <Group justify="space-between" mb="xs">
          <ThemeIcon variant="light" size="lg" radius="md" style={{ backgroundColor: `${category.color}20` }}>
            <span style={{ color: category.color }}>{category.icon}</span>
          </ThemeIcon>
          <IconArrowRight size={18} style={{ color: DEEP_BLUE_TINTS[50], opacity: 0.5 }} />
        </Group>

        <Title order={4} size="h5" mb="xs" c={DEEP_BLUE}>
          {category.title}
        </Title>
        <Text size="sm" style={{ color: DEEP_BLUE_TINTS[60], lineHeight: 1.4 }}>
          {category.description}
        </Text>
      </Card>
    </UnstyledButton>
  );
}

export default function SettingsHubPage() {
  return (
    <Container size="xl" py="xl">
      {/* Hero Section */}
      <Box mb="xl">
        <Group mb="xs">
          <Title order={1} size="h2" c={DEEP_BLUE}>
            Settings
          </Title>
        </Group>
        <Text size="lg" style={{ color: DEEP_BLUE_TINTS[60] }}>
          Configure your Portfolio Planner workspace, integrations, and preferences
        </Text>
      </Box>

      {/* Settings Grid */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {CATEGORIES.map((category) => (
          <SettingCard key={category.path} category={category} />
        ))}
      </SimpleGrid>
    </Container>
  );
}
