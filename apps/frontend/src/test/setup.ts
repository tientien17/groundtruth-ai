/**
 * Test setup for vitest with testing-library matchers.
 */

import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)
