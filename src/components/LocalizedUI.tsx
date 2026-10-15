import React,{forwardRef} from 'react';
import {Text as NativeText,TextInput as NativeTextInput,TouchableOpacity as NativeTouchableOpacity,Alert as NativeAlert,type TextProps,type TextInputProps,type TouchableOpacityProps,type AlertButton,type AlertOptions} from 'react-native';
import {useLanguage,tr,translateText} from '../i18n/language';
export type LocalizedText=NativeText;
export const LocalizedText=forwardRef<NativeText,TextProps&{localize?:boolean}>(({children,localize=true,...props},ref)=>{
 useLanguage();return <NativeText {...props} ref={ref} accessibilityLabel={props.accessibilityLabel?translateText(props.accessibilityLabel):undefined}>{localize?tr(children):children}</NativeText>;
});
export type LocalizedTextInput=NativeTextInput;
export const LocalizedTextInput=forwardRef<NativeTextInput,TextInputProps>((props,ref)=>{
 useLanguage();return <NativeTextInput {...props} ref={ref} placeholder={props.placeholder?translateText(props.placeholder):undefined} accessibilityLabel={props.accessibilityLabel?translateText(props.accessibilityLabel):undefined}/>;
});
export const LocalizedTouchableOpacity=forwardRef<React.ComponentRef<typeof NativeTouchableOpacity>,TouchableOpacityProps>((props,ref)=>{
 useLanguage();return <NativeTouchableOpacity {...props} ref={ref} accessibilityLabel={props.accessibilityLabel?translateText(props.accessibilityLabel):undefined} accessibilityHint={props.accessibilityHint?translateText(props.accessibilityHint):undefined}/>;
});
export const LocalizedAlert={...NativeAlert,alert:(...args:Parameters<typeof NativeAlert.alert>)=>{
 const translated=[...args] as Parameters<typeof NativeAlert.alert>;
 translated[0]=translateText(args[0]);
 if(args.length>1&&args[1])translated[1]=translateText(args[1]);
 if(args.length>2&&args[2])translated[2]=args[2].map(button=>({...button,text:button.text?translateText(button.text):undefined}));
 return NativeAlert.alert(...translated);
}};
