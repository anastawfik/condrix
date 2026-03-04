import React from 'react';
import { Text, Box } from 'ink';

export function NexusCli() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">NexusCore CLI</Text>
      <Text dimColor>Distributed AI Agent Orchestration Platform</Text>
      <Box marginTop={1}>
        <Text>Connecting to Core...</Text>
      </Box>
    </Box>
  );
}
