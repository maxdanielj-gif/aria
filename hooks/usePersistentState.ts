import { useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';

/**
 * Recursively merges default properties from a defaults object into a loaded object.
 * Ensuring that even nested properties added in newer versions of the app are initialized.
 */
function mergeDefaults<T extends object>(loaded: any, defaults: T): T {
    if (!loaded || typeof loaded !== 'object') return { ...defaults };
    
    const result = { ...loaded };

    for (const key in defaults) {
        if (Object.prototype.hasOwnProperty.call(defaults, key)) {
            const defaultValue = (defaults as any)[key];
            const loadedValue = result[key];

            if (loadedValue === undefined || loadedValue === null) {
                result[key] = defaultValue;
            } else if (
                typeof defaultValue === 'object' && 
                defaultValue !== null && 
                !Array.isArray(defaultValue)
            ) {
                result[key] = mergeDefaults(loadedValue, defaultValue);
            }
        }
    }
    return result as T;
}

declare global {
    interface Window {
        INITIAL_APP_STATE?: any;
    }
}

export function usePersistentState<T extends object>(key: string, initialState: T): [T, Dispatch<SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            // Check for portable state first (data.js)
            if (window.INITIAL_APP_STATE) {
                console.log("Loading state from portable data.js...");
                return mergeDefaults(window.INITIAL_APP_STATE, initialState);
            }

            const storedValue = window.localStorage.getItem(key);
            if (storedValue) {
                const loadedState = JSON.parse(storedValue);
                return mergeDefaults(loadedState, initialState);
            }
            return initialState;
        } catch (error) {
            console.error('Error reading state, falling back to initial.', error);
            return initialState;
        }
    });

    const quotaErrorNotified = useRef(false);
    const saveTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (quotaErrorNotified.current) return;

        if (saveTimeoutRef.current !== null) {
            window.clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
            try {
                const dataStr = JSON.stringify(state);
                window.localStorage.setItem(key, dataStr);
            } catch (error) {
                if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                    if (!quotaErrorNotified.current) {
                        console.warn(`LocalStorage quota exceeded.`);
                        quotaErrorNotified.current = true;
                        alert("Storage limit exceeded. Your progress may not be saved unless you clear some chat history or images.");
                    }
                }
            }
        }, 1000);

        return () => {
            if (saveTimeoutRef.current !== null) {
                window.clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [key, state]);

    return [state, setState];
}