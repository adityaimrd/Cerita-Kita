import { convertBase64ToUint8Array } from './index'; 
import { VAPID_PUBLIC_KEY } from '../config'; 
import { subscribePushNotification, unsubscribePushNotification } from '../data/api'; 

export function isNotificationAvailable() {
    return 'Notification' in window;
}

export function isNotificationGranted() {
    return Notification.permission === 'granted';
}

export async function requestNotificationPermission() {
    if (!isNotificationAvailable()) {
        console.error('Notification API unsupported.');
        return false; 
    }

    if (isNotificationGranted()) {
        return true; 
    }

    const status = await Notification.requestPermission();

    if (status === 'denied') {
        alert('Izin notifikasi ditolak.');
        return false;
    }

    if (status === 'default') {
        alert('Izinn notifikasi ditutup atau diabaikan.');
        return false;
    }

    return true; 
}

export async function getPushSubscription() {
    const registration = await navigator.serviceWorker.getRegistration();
    return await registration.pushManager.getSubscription();
}

export async function isCurrentPushSubscriptionAvailable() {
    return !!(await getPushSubscription());
}


export function generateSubscribeOptions() {
    return {
        userVisibleOnly: true, 
        applicationServerKey: convertBase64ToUint8Array(VAPID_PUBLIC_KEY), 
    };
}

export async function subcribe() {
    if (!(await requestNotificationPermission())) {
        return;
    }

    if (await isCurrentPushSubscriptionAvailable()) {
        alert('Sudah berlangganan push notification.');
        return;
    }

    console.log('Mulai berlangganan push notifcation...');

    const failureSubscribeMessage = 'Langganan push notification gagal diaktifkan.';
    const successSubscribeMessage = 'Langganan push notification berhasil diaktifkan.';

    let pushSubscription;

    try {
        const registration = await navigator.serviceWorker.getRegistration();

        pushSubscription = await registration.pushManager.subscribe(generateSubscribeOptions());

        const { endpoint, keys } = pushSubscription.toJSON();

        const response = await subscribePushNotification({ endpoint, keys });

        if (!response.ok) {
            console.error('subscribe: response:', response);
            alert(failureSubscribeMessage);

            await pushSubscription.unsubscribe(); 

            return;
        }

        alert(successSubscribeMessage); // Berhasil subscribe
    } catch (error) {
        console.error('subscribe: error:', error);
        alert(failureSubscribeMessage);

        // Jika terjadi error, pastikan subscription dibatalkan
        await pushSubscription.unsubscribe();
    }
}

// Fungsi untuk membatalkan langganan push notification
export async function unsubscribe() {
    const failureUnsubscribeMessage = 'Langganan push notification gagal dinonaktifkan.';
    const successUnsubscribeMessage = 'Langganan push notification berhasil dinonaktifkan.';

    try {
        // Ambil subscription yang sedang aktif
        const pushSubscription = await getPushSubscription();

        // Jika belum berlangganan, beri tahu pengguna dan keluar
        if (!pushSubscription) {
            alert('Tidak bisa memutus langganan push notification karena belum berlangganan sebelumnya.');
            return;
        }

        // Ambil endpoint dan keys dari subscription untuk dikirim ke backend
        const { endpoint, keys } = pushSubscription.toJSON();

        // Kirim permintaan unsubscribe ke backend
        const response = await unsubscribePushNotification({ endpoint });

        if (!response.ok) {
            alert(failureUnsubscribeMessage);
            console.error('unsubscribe: response:', response);

            return;
        }

        const unsubscribed = await pushSubscription.unsubscribe();

        if (!unsubscribed) {
            alert(failureUnsubscribeMessage);
            await subscribePushNotification({ endpoint, keys });

            return;
        }

        alert(successUnsubscribeMessage); // Berhasil unsubscribe
    } catch (error) {
        alert(failureUnsubscribeMessage);
        console.error('unsubscribe: error:', error);
    }
}
