import {getApps} from '@react-native-firebase/app';
import {getMessaging,setBackgroundMessageHandler} from '@react-native-firebase/messaging';
/**
 * @format
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

if(getApps().length) setBackgroundMessageHandler(getMessaging(),async()=>{});
