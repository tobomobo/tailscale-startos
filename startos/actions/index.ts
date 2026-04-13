import { sdk } from '../sdk'
import { addExposure } from './addExposure'
import { addExposureFromUrl } from './addExposureFromUrl'
import { refreshLoginLink } from './refreshLoginLink'
import { refreshExposures } from './refreshExposures'
import { removeExposure } from './removeExposure'
import { removeExposureFromUrl } from './removeExposureFromUrl'
import { setDeviceName } from './setDeviceName'
import { showDeviceInfo } from './showDeviceInfo'
import { showLoginLink } from './showLoginLink'
import { showExposures } from './showExposures'

export const actions = sdk.Actions.of()
  .addAction(setDeviceName)
  .addAction(showDeviceInfo)
  .addAction(showLoginLink)
  .addAction(refreshLoginLink)
  .addAction(addExposure)
  .addAction(addExposureFromUrl)
  .addAction(removeExposure)
  .addAction(removeExposureFromUrl)
  .addAction(showExposures)
  .addAction(refreshExposures)
