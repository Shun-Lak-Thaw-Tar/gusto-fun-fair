import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./live',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:5173',headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}});
