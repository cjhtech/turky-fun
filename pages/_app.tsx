import { ChakraProvider } from "@chakra-ui/react";
import { PrivyProvider } from "@privy-io/react-auth";
import type { AppProps } from "next/app";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID as string;

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "light",
          accentColor: "#676FFF",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: {
          id: 8453,
          name: "Base",
          network: "base",
          rpcUrls: {
            default: { http: ["https://mainnet.base.org"] },
          },
          nativeCurrency: {
            name: "ETH",
            symbol: "ETH",
            decimals: 18,
          },
        },
        supportedChains: [
          {
            id: 8453,
            name: "Base",
            network: "base",
            rpcUrls: {
              default: { http: ["https://mainnet.base.org"] },
            },
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
          },
        ],
      }}
    >
      <ChakraProvider>
        <Component {...pageProps} />
      </ChakraProvider>
    </PrivyProvider>
  );
}

export default MyApp;
