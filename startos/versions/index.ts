import { VersionGraph } from '@start9labs/start-sdk'
import { v_1_96_5_7 } from './v1.96.5.7'
import { v_1_96_5_6 } from './v1.96.5.6'
import { v_1_96_5_5 } from './v1.96.5.5'
import { v_1_96_5_4 } from './v1.96.5.4'
import { v_1_96_5_3 } from './v1.96.5.3'
import { v_1_96_5_2 } from './v1.96.5.2'
import { v_1_96_5_1 } from './v1.96.5.1'
import { v_1_92_5_2 } from './v1.92.5.2'

export const versionGraph = VersionGraph.of({
  current: v_1_96_5_7,
  other: [v_1_96_5_6, v_1_96_5_5, v_1_96_5_4, v_1_96_5_3, v_1_96_5_2, v_1_96_5_1, v_1_92_5_2],
})
