import React, { useState } from 'react';
import {
  Container, Title, Grid, Card, Chip, Stack, Text, Group, Drawer,
  Button, NumberInput, Select, Loader, Center,
} from '@mantine/core';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

interface SkillEntry {
  resourceName: string;
  skillName: string;
  proficiencyLevel: number;
}

const MOCK_CATEGORIES = ['Engineering', 'Data & Analytics', 'Product & Design', 'Project Management'];
const MOCK_RESOURCES = [
  'Alice Chen', 'Bob Johnson', 'Carol Smith', 'David Lee',
  'Eva Martinez', 'Frank Wilson', 'Grace Taylor', 'Henry Brown',
  'Iris Thompson', 'Jack Davis',
];
const MOCK_SKILLS = [
  'Java', 'Python', 'React', 'AWS',
  'SQL', 'Power BI', 'Agile', 'System Design',
];

const generateMockSkills = (): SkillEntry[] => {
  const skills: SkillEntry[] = [];
  MOCK_RESOURCES.forEach(resource => {
    MOCK_SKILLS.forEach(skill => {
      skills.push({
        resourceName: resource,
        skillName: skill,
        proficiencyLevel: Math.floor(Math.random() * 10) + 1,
      });
    });
  });
  return skills;
};

const MOCK_SKILL_DATA = generateMockSkills();

function getProficiencyColor(level: number): string {
  if (level === 0) return '#E0E0E0';
  if (level <= 3) return '#FF6B6B';
  if (level <= 6) return '#FFC922';
  if (level <= 9) return '#8FE928';
  return '#2ECC71';
}

export default function SkillsMatrixPage() {
  const isDarkMode = useDarkMode();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addSkillOpen, setAddSkillOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [proficiencyLevel, setProficiencyLevel] = useState(5);

  const filteredSkills = selectedCategory
    ? MOCK_SKILLS.filter(s => {
        if (selectedCategory === 'Engineering') return ['Java', 'Python', 'React', 'AWS'].includes(s);
        if (selectedCategory === 'Data & Analytics') return ['SQL', 'Power BI'].includes(s);
        if (selectedCategory === 'Project Management') return ['Agile'].includes(s);
        if (selectedCategory === 'Product & Design') return ['System Design'].includes(s);
        return true;
      })
    : MOCK_SKILLS;

  const getSkillLevel = (resource: string, skill: string): number => {
    const entry = MOCK_SKILL_DATA.find(
      e => e.resourceName === resource && e.skillName === skill
    );
    return entry?.proficiencyLevel || 0;
  };

  const handleAddSkill = () => {
    if (selectedResource && selectedSkill) {
      setAddSkillOpen(false);
      setSelectedResource(null);
      setSelectedSkill(null);
      setProficiencyLevel(5);
    }
  };

  const bgColor = isDarkMode ? '#1E1E1E' : '#FFF';
  const borderColor = isDarkMode ? '#333' : '#DDD';

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2} style={{ fontFamily: FONT_FAMILY }}>
          Skills Matrix
        </Title>
        <Button
          onClick={() => setAddSkillOpen(true)}
          color="aqua"
          size="sm"
        >
          Add Skill
        </Button>
      </Group>

      <Card
        shadow="sm"
        padding="md"
        radius="md"
        mb="lg"
        style={{ backgroundColor: bgColor, borderColor }}
      >
        <Stack gap="sm">
          <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>
            Filter by Category
          </Text>
          <Group>
            <Chip
              checked={selectedCategory === null}
              onChange={() => setSelectedCategory(null)}
              variant="outline"
            >
              All
            </Chip>
            {MOCK_CATEGORIES.map(cat => (
              <Chip
                key={cat}
                checked={selectedCategory === cat}
                onChange={() => setSelectedCategory(cat)}
                variant="outline"
              >
                {cat}
              </Chip>
            ))}
          </Group>
        </Stack>
      </Card>

      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        style={{ backgroundColor: bgColor, borderColor, overflowX: 'auto' }}
      >
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `150px repeat(${filteredSkills.length}, 60px)`,
              gap: '1px',
              backgroundColor: isDarkMode ? '#333' : '#DDD',
              padding: '1px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5',
                padding: '8px',
                fontWeight: 600,
                fontSize: '12px',
                fontFamily: FONT_FAMILY,
              }}
            >
              Resource
            </div>
            {filteredSkills.map(skill => (
              <div
                key={skill}
                style={{
                  backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5',
                  padding: '8px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '11px',
                  fontFamily: FONT_FAMILY,
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                }}
              >
                {skill}
              </div>
            ))}
          </div>

          {MOCK_RESOURCES.map(resource => (
            <div
              key={resource}
              style={{
                display: 'grid',
                gridTemplateColumns: `150px repeat(${filteredSkills.length}, 60px)`,
                gap: '1px',
                backgroundColor: isDarkMode ? '#333' : '#DDD',
                padding: '1px',
                marginBottom: '1px',
              }}
            >
              <div
                style={{
                  backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5',
                  padding: '8px',
                  fontWeight: 500,
                  fontSize: '12px',
                  fontFamily: FONT_FAMILY,
                  wordBreak: 'break-word',
                }}
              >
                {resource}
              </div>
              {filteredSkills.map(skill => {
                const level = getSkillLevel(resource, skill);
                return (
                  <div
                    key={`${resource}-${skill}`}
                    style={{
                      backgroundColor: getProficiencyColor(level),
                      padding: '8px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      color: level > 6 ? '#000' : '#333',
                      cursor: 'pointer',
                      transition: 'opacity 200ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {level || '—'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <Group mt="lg" gap="md">
          <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
            Proficiency:
          </Text>
          <Group gap="xs">
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#FF6B6B',
                borderRadius: '4px',
              }}
            />
            <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
              1-3
            </Text>
          </Group>
          <Group gap="xs">
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#FFC922',
                borderRadius: '4px',
              }}
            />
            <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
              4-6
            </Text>
          </Group>
          <Group gap="xs">
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#8FE928',
                borderRadius: '4px',
              }}
            />
            <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
              7-9
            </Text>
          </Group>
          <Group gap="xs">
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#2ECC71',
                borderRadius: '4px',
              }}
            />
            <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
              10
            </Text>
          </Group>
        </Group>
      </Card>

      <Drawer
        opened={addSkillOpen}
        onClose={() => setAddSkillOpen(false)}
        title={<Text style={{ fontFamily: FONT_FAMILY }}>Add Skill</Text>}
        position="right"
      >
        <Stack gap="md">
          <Select
            label="Resource"
            placeholder="Select resource"
            data={MOCK_RESOURCES}
            value={selectedResource}
            onChange={setSelectedResource}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <Select
            label="Skill"
            placeholder="Select skill"
            data={filteredSkills}
            value={selectedSkill}
            onChange={setSelectedSkill}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <NumberInput
            label="Proficiency Level (1-10)"
            min={1}
            max={10}
            value={proficiencyLevel}
            onChange={(val) => setProficiencyLevel(Number(val) || 5)}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAddSkillOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSkill} color="aqua">
              Add
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Container>
  );
}
