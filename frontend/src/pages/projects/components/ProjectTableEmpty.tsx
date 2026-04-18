import EmptyState from '../../../components/common/EmptyState';
import { IconBriefcase as IconBriefcaseEmpty, IconFilter } from '@tabler/icons-react';

interface ProjectTableEmptyProps {
  hasAnyProjects: boolean;
  onCreateProject: () => void;
  onImportJira: () => void;
  onClearFilters: () => void;
}

export default function ProjectTableEmpty(props: ProjectTableEmptyProps) {
  const {
    hasAnyProjects,
    onCreateProject,
    onImportJira,
    onClearFilters,
  } = props;

  if (!hasAnyProjects) {
    return (
      <EmptyState
        icon={<IconBriefcaseEmpty size={40} />}
        title="No projects yet"
        description="Create your first project to start planning and tracking work across your portfolio."
        action={{
          label: '+ Create Project',
          onClick: onCreateProject,
          variant: 'filled',
          color: 'teal',
        }}
        secondaryAction={{
          label: 'Import from Jira',
          onClick: onImportJira,
          variant: 'light',
        }}
        tips={['Tip: use ⌘K to quickly jump to any project', 'Set up Jira integration to auto-sync epics and sprints']}
        size="lg"
      />
    );
  }

  return (
    <EmptyState
      icon={<IconFilter size={36} />}
      title="No projects match your filters"
      description="Try adjusting or clearing the filters above."
      action={{
        label: 'Clear all filters',
        onClick: onClearFilters,
        variant: 'light',
        color: 'gray',
      }}
      size="md"
    />
  );
}
