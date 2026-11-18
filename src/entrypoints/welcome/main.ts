import { mount } from 'svelte';
import { ChromeWelcomeClient } from '@/lib/state/welcome.svelte';
import WelcomePage from '@/lib/ui/welcome/WelcomePage.svelte';
import '@/styles/page.css';

const client = new ChromeWelcomeClient();
void client.start();
mount(WelcomePage, { target: document.getElementById('app')!, props: { client } });
