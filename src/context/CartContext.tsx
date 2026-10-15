import { LocalizedAlert as Alert } from "../components/LocalizedUI";
import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from 'react';

import {
  addCartItem,
  clearRemoteCart,
  loadCart,
  removeCartItem,
} from '../services/supabaseData';
import { supabase } from '../lib/supabase';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  location: string;
  img: string;
  quantity: number;
  sellerId: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, options?: { silent?: boolean }) => Promise<boolean>;
  removeFromCart: (id: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  clearCart: (options?: { localOnly?: boolean }) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const refreshCart = () =>
      loadCart()
        .then(setCartItems)
        .catch(() => setCartItems([]));

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) refreshCart();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) refreshCart();
        else setCartItems([]);
      },
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  const addToCart = async (product: any, options?: { silent?: boolean }) => {
    if (cartItems.some(item => item.id === product.id)) {
      if (!options?.silent) Alert.alert('提示', '此商品已經在購物車中囉！');
      return true;
    }
    try {
      await addCartItem(product.id);
      setCartItems(prev =>
        prev.some(item => item.id === product.id)
          ? prev
          : [...prev, { ...product, quantity: 1 }],
      );
      if (!options?.silent) Alert.alert('成功', '已加入購物車。');
      return true;
    } catch (error) {
      Alert.alert(
        '加入失敗',
        error instanceof Error ? error.message : '請稍後再試',
      );
      return false;
    }
  };

  const removeFromCart = async (id: string) => {
    try {
      await removeCartItem(id);
      setCartItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      Alert.alert(
        '移除失敗',
        error instanceof Error ? error.message : '請稍後再試',
      );
    }
  };

  const refreshCart = async () => {
    setCartItems(await loadCart());
  };
  const clearCart = async (options?: { localOnly?: boolean }) => {
    if (!options?.localOnly) await clearRemoteCart();
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{ cartItems, addToCart, removeFromCart, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart 必須在 CartProvider 內使用');
  return context;
};
