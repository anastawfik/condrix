import React from 'react';
import { Text, Box } from 'ink';

export function CondrixCli() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Condrix CLI</Text>
      <Text dimColor>Distributed AI Agent Orchestration Platform</Text>
      <Box marginTop={1}>
        <Text>Connecting to Core...</Text>
      </Box>
    </Box>
  );
}
