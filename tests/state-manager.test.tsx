import { expect, test } from 'vitest';
import { StateManager } from '../src/state-manager';
import { Logger } from '../src/utils/logger';
import * as React from 'react';



test('State Manager Init', () => {
  let stateManager = new StateManager(
   'test-state-manager',
    new Logger('test-logger'),
    {},
    {},
    {},
    null,
    {}
  );
  // Simple test to check if the stateManager is initialized correctly
  // and have a local reference to the StateManager init API
  expect(stateManager).toBeInstanceOf(StateManager);
  expect(stateManager.id).toBe('test-state-manager');
    expect(stateManager.logger).toBeInstanceOf(Logger);
    expect(stateManager.logger.id).toBe('test-logger');
    expect(stateManager.componentStateMap).toEqual({});
    expect(stateManager.componentOutputMap).toEqual({});
    expect(stateManager.remoteFSMMap).toEqual({});

  /* We should be able to short init the StateManager without passing all parameters */
  stateManager = new StateManager('test-state-manager-2');
  expect(stateManager).toBeInstanceOf(StateManager);
});