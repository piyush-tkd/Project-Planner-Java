import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container, Title, Card, Chip, Stack, Text, Group, Drawer,
  Button, Select, TextInput, Loader, Center, Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/client';
import EmptyState from '../components/common/EmptyState';
import { IconStars, IconPlugConnected } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────

interface SkillResponse {
  id: number;
  resourceId: number;
  skillName: string;
  proficiency: number;       // 1=Beginner 2=Intermediate 3=Advanced 4=Expert
  proficiencyLabel: string;
  yearsExperience: number | null;
}

interface SkillMatrixRow {
  resourceId: number;
  resourceName: string;
  role: string | null;
  podName: string | null;
  skills: SkillResponse[];
}

interface SkillCategory {
  id: number;
  name: string;
}

interface Skill {
  id: number;
  name: string;
  category: { id: number; name: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getProficiencyColor(level: number): string {
  if (level === 0) return '#E0E0E0';
  if (level === 1) return '#FF6B6B';   // Beginner
  if (level === 2) return '#FFC922';   // Intermediate
  if (level === 3) return '#8FE928';   // Advanced
  return '#2ECC71';                     // Expert
}

function getProficiencyLabel(level: number): string {
  return ['—', 'Beginner', 'Intermediate', 'Advanced', 'Expert'][level] ?? '—';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SkillsMatrixPage() {
  const isDark = useDarkMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selResourceId, setSelResourceId] = useState<string | null>(null);
  const [selSkillName, setSelSkillName] = useState<string | null>(null);
  const [selProficiency, setSelProficiency] = useState<string>('2');

  // ── Data ──
  const { data: matrixRows = [], isLoading } = useQuery<SkillMatrixRow[]>({
    queryKey: ['skills-matrix'],
    queryFn: () => apiClient.get('/resources/skills/matrix').then(r => r.data),
  });

  const { data: categories = [] } = useQuery<SkillCategory[]>({
    queryKey: ['skill-categories'],
    queryFn: () => apiClient.get('/skills/categories').then(r => r.data),
  });

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: () => apiClient.get('/skills').then(r => r.data),
  });

  // skill name → category name mapping (for filtering)
  const skillCatMap: Record<string, string> = {};
  skills.forEach(s => { if (s.category?.name) skillCatMap[s.name] = s.category.name; });

  // All distinct skill names across all resources
  const allSkillNames = Array.from(
    new Set(matrixRows.flatMap(r => r.skills.map(s => s.skillName)))
  ).sort();

  // Unique category names (from taxonomy + "Other" for uncategorised)
  const usedCategoryNames = Array.from(new Set([
    ...categories.map(c => c.name),
    ...(allSkillNames.some(n => !skillCatMap[n]) ? ['Other'] : []),
  ]));

  const filteredSkillNames = selectedCategory
    ? allSkillNames.filter(n => (skillCatMap[n] ?? 'Other') === selectedCategory)
    : allSkillNames;

  // ── Mutation ──
  const addMutation = useMutation({
    mutationFn: ({ resourceId, skillName, proficiency }: { resourceId: number; skillName: string; proficiency: number }) =>
      apiClient.post(`/resources/${resourceId}/skills`, { skillName, proficiency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills-matrix'] });
      setAddOpen(false);
      setSelResourceId(null);
      setSelSkillName(null);
      setSelProficiency('2');
      notifications.show({ title: 'Skill saved', message: 'Skills matrix updated.', color: 'teal' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to save skill.', color: 'red' });
    },
  });

  const getLevel = (row: SkillMatrixRow, skillName: string) =>
    row.skills.find(s => s.skillName === skillName)?.proficiency ?? 0;

  const bg = isDark ? '#1E1E1E' : '#FFF';
  const border = isDark ? '#333' : '#DDD';

  if (isLoading) {
    return <Center py="xl"><Loader color="teal" /></Center>;
  }

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2} style={{ fontFamily: FONT_FAMILY }}>Skills Matrix</Title>
        <Button onClick={() => setAddOpen(true)} color="teal" size="sm">
          + Add Skill
        </Button>
      </Group>

      {matrixRows.length === 0 && (
        /* PP-13 §7: standardised empty state */
        <EmptyState
          icon={<IconStars size={40} />}
          title="Skills matrix is empty"
          description="Import skills from Jira or manually add team members and their expertise to start building your skills profile."
          action={{ label: '+ Add Skill', onClick: () => setAddOpen(true), variant: 'filled', color: 'teal' }}
          secondaryAction={{ label: 'Go to Resources', onClick: () => navigate('/people/resources'), variant: 'light' }}
          tips={['Skills are added per resource — navigate to a resource profile to add skills there too', 'Use categories (Backend, Frontend, Cloud…) to organise the matrix']}
          size="lg"
          color="teal"
        />
      )}

      {/* Category filter */}
      <Card shadow="sm" padding="md" radius="md" mb="lg" style={{ backgroundColor: bg, borderColor: border }}>
        <Stack gap="sm">
          <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>Filter by Category</Text>
          <Group>
            <Chip checked={selectedCategory === null} onChange={() => setSelectedCategory(null)} variant="outline">
              All ({allSkillNames.length})
            </Chip>
            {usedCategoryNames.map(cat => {
              const count = allSkillNames.filter(n => (skillCatMap[n] ?? 'Other') === cat).length;
              return (
                <Chip key={cat} checked={selectedCategory === cat} onChange={() => setSelectedCategory(cat)} variant="outline">
                  {cat} ({count})
                </Chip>
              );
            })}
          </Group>
        </Stack>
      </Card>

      {/* Matrix grid */}
      {filteredSkillNames.length > 0 && matrixRows.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" style={{ backgroundColor: bg, borderColor: border, overflowX: 'auto' }}>
          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `200px repeat(${filteredSkillNames.length}, 64px)`,
              gap: '1px', backgroundColor: isDark ? '#333' : '#DDD',
              padding: '1px', marginBottom: '10px',
            }}>
              <div style={{ backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0', padding: '8px', fontWeight: 600, fontSize: '12px', fontFamily: FONT_FAMILY }}>
                Resource
              </div>
              {filteredSkillNames.map(skill => (
                <div key={skill} style={{
                  backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0',
                  padding: '8px', textAlign: 'center', fontWeight: 600, fontSize: '11px',
                  fontFamily: FONT_FAMILY, writingMode: 'vertical-rl',
                  textOrientation: 'mixed', transform: 'rotate(180deg)',
                  height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {skill}
                </div>
              ))}
            </div>

            {/* Rows */}
            {matrixRows.map(row => (
              <div key={row.resourceId} style={{
                display: 'grid',
                gridTemplateColumns: `200px repeat(${filteredSkillNames.length}, 64px)`,
                gap: '1px', backgroundColor: isDark ? '#333' : '#DDD',
                padding: '1px', marginBottom: '1px',
              }}>
                <div style={{
                  backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                  padding: '8px', fontWeight: 500, fontSize: '12px',
                  fontFamily: FONT_FAMILY, wordBreak: 'break-word',
                }}>
                  <div>{row.resourceName}</div>
                  {row.role && (
                    <div style={{ fontSize: 10, color: isDark ? '#999' : '#666', marginTop: 2 }}>{row.role}</div>
                  )}
                </div>
                {filteredSkillNames.map(skill => {
                  const level = getLevel(row, skill);
                  return (
                    <div
                      key={`${row.resourceId}-${skill}`}
                      title={level ? `${getProficiencyLabel(level)} (${level}/4)` : 'Not assessed'}
                      style={{
                        backgroundColor: getProficiencyColor(level),
                        padding: '8px', textAlign: 'center', fontSize: '12px',
                        fontFamily: FONT_FAMILY, fontWeight: 700,
                        color: level >= 3 ? '#000' : '#333',
                        cursor: 'default', transition: 'opacity 180ms',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {level || '—'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <Group mt="lg" gap="lg">
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Proficiency scale:</Text>
            {[
              { color: '#FF6B6B', label: '1 — Beginner' },
              { color: '#FFC922', label: '2 — Intermediate' },
              { color: '#8FE928', label: '3 — Advanced' },
              { color: '#2ECC71', label: '4 — Expert' },
            ].map(item => (
              <Group key={item.label} gap={6}>
                <div style={{ width: 14, height: 14, backgroundColor: item.color, borderRadius: 3 }} />
                <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{item.label}</Text>
              </Group>
            ))}
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY, marginLeft: 'auto' }}>
              {matrixRows.length} resources · {allSkillNames.length} skills
            </Text>
          </Group>
        </Card>
      )}

      {/* Add Skill Drawer */}
      <Drawer
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY }}>Add / Update Skill</Text>}
        position="right"
        size="sm"
      >
        <Stack gap="md">
          <Select
            label="Resource"
            placeholder="Select resource..."
            data={matrixRows.map(r => ({ value: String(r.resourceId), label: r.resourceName }))}
            value={selResourceId}
            onChange={setSelResourceId}
            searchable
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <TextInput
            label="Skill Name"
            placeholder="e.g. Java, React, SQL..."
            value={selSkillName ?? ''}
            onChange={e => setSelSkillName(e.currentTarget.value || null)}
            list="skill-suggestions"
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <datalist id="skill-suggestions">
            {allSkillNames.map(s => <option key={s} value={s} />)}
          </datalist>
          <Select
            label="Proficiency Level"
            data={[
              { value: '1', label: '1 — Beginner' },
              { value: '2', label: '2 — Intermediate' },
              { value: '3', label: '3 — Advanced' },
              { value: '4', label: '4 — Expert' },
            ]}
            value={selProficiency}
            onChange={v => setSelProficiency(v ?? '2')}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              color="teal"
              loading={addMutation.isPending}
              disabled={!selResourceId || !selSkillName}
              onClick={() => addMutation.mutate({
                resourceId: Number(selResourceId),
                skillName: selSkillName!,
                proficiency: Number(selProficiency),
              })}
            >
              Save Skill
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Container>
  );
}
