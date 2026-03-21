import { Button } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';

export const PrintButton = () => {
  return (
    <Button
      leftSection={<IconPrinter size={16} />}
      variant="subtle"
      size="xs"
      onClick={() => window.print()}
    >
      Print / PDF
    </Button>
  );
};
