import { Center, Loader } from '@mantine/core';

export default function LoadingSpinner() {
  return (
    <Center style={{ minHeight: 200 }}>
      <Loader size="lg" />
    </Center>
  );
}
