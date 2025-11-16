import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import api, { API_BASE_URL } from '../../api/client';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';

export default function CompanySelectorScreen({ navigation }){
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const { user } = useAuth();
  const isSuper = (user?.role || '').toLowerCase() === 'superadmin';

  useEffect(()=>{
    let mounted = true;
    const load = async ()=>{
      try{
        const res = await fetch(`${API_BASE_URL}/api/personas/empresas?limit=500`, { credentials: 'include' });
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        if(mounted) setCompanies(items);
      }catch(e){
        console.error('Error loading companies', e);
      }finally{ if(mounted) setLoading(false); }
    };
    load();
    return ()=>{ mounted = false };
  },[]);

  const selectCompany = async (id)=>{
    try{
      await SecureStore.setItemAsync('empresaId', String(id || ''));
      navigation.goBack();
    }catch(e){
      console.error('Error saving empresaId', e);
    }
  };

  if(!isSuper){
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text>Solo SuperAdmin puede cambiar de empresa</Text>
      </View>
    );
  }

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'600', marginBottom:12 }}>Seleccionar Empresa</Text>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item)=> String(item.id_empresa)}
          renderItem={({item}) => (
            <TouchableOpacity onPress={()=> selectCompany(item.id_empresa)} style={{ padding:12, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, marginBottom:8 }}>
              <Text style={{ fontSize:16 }}>{item.nombre_empresa}</Text>
              <Text style={{ color:'#6b7280' }}>ID: {item.id_empresa}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
