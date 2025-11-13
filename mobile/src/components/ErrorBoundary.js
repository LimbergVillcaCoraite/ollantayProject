import React from 'react';
import { View, Text } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24, backgroundColor:'#fff' }}>
          <Text style={{ fontSize:18, fontWeight:'600', marginBottom:12 }}>Se produjo un error</Text>
          <Text style={{ fontSize:14, color:'#dc2626', marginBottom:8 }} numberOfLines={6}>
            {String(this.state.error?.message || 'Error desconocido')}
          </Text>
          <Text style={{ fontSize:12, color:'#6b7280' }}>Revise la consola de Metro / adb logcat para mas detalles.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
