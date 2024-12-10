import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  VStack,
  Button,
  Image,
  Text,
  Box,
  Container,
  Heading,
  useColorModeValue,
  Badge,
  Flex,
  Divider,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useBreakpointValue,
  useToast,
  Spinner,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import MintAndStakeABI from "../abis/MintAndStake.json";
import { ChevronDownIcon } from "@chakra-ui/icons";
import Head from "next/head";

// Contract addresses
const MINT_AND_STAKE_ADDRESS = process.env
  .NEXT_PUBLIC_MINT_AND_STAKE_ADDRESS as string;
const TURKY_TOKEN_ADDRESS = process.env
  .NEXT_PUBLIC_TURKY_TOKEN_ADDRESS as string;

if (!MINT_AND_STAKE_ADDRESS || !TURKY_TOKEN_ADDRESS) {
  throw new Error("Missing contract address environment variables");
}

// Simple ERC20 ABI for approval
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

// Add this type declaration at the top of the file
declare global {
  interface Window {
    ethereum?: any;
  }
}

function MainPage() {
  const { authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [wallet] = wallets ?? []; // Safe destructuring with fallback
  const [gifVisible, setGifVisible] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState<boolean>(true);
  const [stakeAmount, setStakeAmount] = useState<string>("1");
  const [stakedTurkyBalance, setStakedTurkyBalance] = useState<string>("0");
  const [mstBalance, setMstBalance] = useState<string>("0");
  const [timeUntilUnlock, setTimeUntilUnlock] = useState<string>("");
  const unlockDate = new Date("2024-12-25T00:00:00.000Z");
  const [isMinting, setIsMinting] = useState(false);
  const toast = useToast();
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Add new state and date constant
  const stakingDeadline = new Date("2024-12-21T00:00:00.000Z");
  const [timeUntilStakingEnds, setTimeUntilStakingEnds] = useState<string>("");

  // Add new state
  const [isUnstaking, setIsUnstaking] = useState(false);

  const checkApproval = async () => {
    if (!userAddress || !wallets || wallets.length === 0) return;

    try {
      if (!wallet) return;
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      // Create contract instance
      const turkyToken = new ethers.Contract(
        TURKY_TOKEN_ADDRESS,
        ERC20_ABI,
        signer
      );

      const allowance = await turkyToken.allowance(
        userAddress,
        MINT_AND_STAKE_ADDRESS
      );
      const requiredAmount = ethers.parseEther("1");

      setNeedsApproval(allowance < requiredAmount);
    } catch (err) {
      console.error("Error checking approval:", err);
    }
  };

  const updateBalances = async () => {
    if (!userAddress || !wallets || wallets.length === 0) return;

    try {
      setIsLoadingBalances(true);
      if (!wallet) return;
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      const mintAndStake = new ethers.Contract(
        MINT_AND_STAKE_ADDRESS,
        MintAndStakeABI.abi,
        signer
      );

      const stakedBal = await mintAndStake.stakedBalances(userAddress);
      setStakedTurkyBalance(ethers.formatEther(stakedBal));

      const sauceBal = await mintAndStake.balanceOf(userAddress);
      setMstBalance(ethers.formatEther(sauceBal));

      console.log("Staked TURKY:", ethers.formatEther(stakedBal));
      console.log("SAUCE Balance:", ethers.formatEther(sauceBal));
    } catch (err) {
      console.error("Error fetching balances:", err);
      setStakedTurkyBalance("0");
      setMstBalance("0");
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (wallets && wallets.length > 0) {
      setUserAddress(wallets[0].address || null);
    } else {
      setUserAddress(null);
    }
  }, [wallets]);

  useEffect(() => {
    if (userAddress) {
      checkApproval();
      updateBalances();
      const interval = setInterval(updateBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [userAddress]);

  const handleApproveMintLock = async () => {
    console.log("Button clicked");

    if (!userAddress || !wallets || wallets.length === 0) {
      alert("Connect your wallet first.");
      return;
    }
    console.log("Wallet check passed");

    try {
      if (!wallet) return;
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      if (needsApproval) {
        try {
          setIsApproving(true);
          const turkyToken = new ethers.Contract(
            TURKY_TOKEN_ADDRESS,
            ERC20_ABI,
            signer
          );

          const approvalTx = await turkyToken.approve(
            MINT_AND_STAKE_ADDRESS,
            ethers.MaxUint256,
            { gasLimit: 100000 }
          );

          await approvalTx.wait();
          setNeedsApproval(false);

          toast({
            title: "Approval Successful!",
            description: "Balance approved, you may now stake your tokens",
            status: "success",
            duration: 5000,
            isClosable: true,
            position: "top",
            containerStyle: {
              background: "#00ff00",
              color: "black",
            },
          });

          return;
        } catch (approvalError) {
          throw approvalError;
        } finally {
          setIsApproving(false);
        }
      }

      setIsStaking(true);
      setGifVisible(true);
      setIsMinting(true);

      const mintAndStake = new ethers.Contract(
        MINT_AND_STAKE_ADDRESS,
        MintAndStakeABI.abi,
        signer
      );

      const amount = ethers.parseEther(stakeAmount);
      const mintAndStakeTx = await mintAndStake.mintAndStake(amount);
      await mintAndStakeTx.wait();

      // Hide GIF immediately after transaction
      setGifVisible(false);
      setIsMinting(false);

      // Show success toast with Add to Wallet button
      toast({
        title: "Stake Successful!",
        description: (
          <Flex direction="column" gap={2}>
            <Text>You received {stakeAmount} SAUCE tokens!</Text>
            <Button
              size="xs"
              variant="outline"
              borderColor="#00ff00"
              color="#00ff00"
              onClick={addSauceToWallet}
              _hover={{ bg: "rgba(0, 255, 0, 0.1)" }}
            >
              Add SAUCE to Wallet
            </Button>
          </Flex>
        ),
        status: "success",
        duration: 8000, // Increased duration to give time to click
        isClosable: true,
        position: "top",
        variant: "solid",
        containerStyle: {
          background: "#00ff00",
          color: "black",
        },
      });
    } catch (err) {
      console.error("Transaction failed:", err);
      setGifVisible(false);
      setIsMinting(false);
      toast({
        title: "Transaction Failed",
        description: "Please check console for details",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsStaking(false);
      checkApproval();
      updateBalances();
    }
  };

  const glowKeyframes = keyframes`
    0% { box-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00; }
    50% { box-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00; }
    100% { box-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00; }
  `;
  const glowAnimation = `${glowKeyframes} 2s infinite`;

  // Add responsive values
  const headingSize = useBreakpointValue({ base: "4xl", md: "6xl" });
  const textSize = useBreakpointValue({ base: "lg", md: "2xl" });
  const badgeSize = useBreakpointValue({ base: "lg", md: "2xl" });
  const buttonHeight = useBreakpointValue({ base: "12", md: "16" });
  const containerPadding = useBreakpointValue({ base: 4, md: 8 });
  const videoSize = useBreakpointValue({ base: "250px", md: "300px" });

  // Update countdown function
  const updateCountdown = useCallback(() => {
    const now = new Date();
    const diff = unlockDate.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeUntilUnlock("Unlocked");
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeUntilUnlock(`${days}d ${hours}h ${minutes}m ${seconds}s`);
  }, [unlockDate]);

  // Update interval to run every second instead of minute
  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  // Add unstake function
  const handleUnstake = async () => {
    if (!userAddress || !wallets || wallets.length === 0) return;

    try {
      setIsUnstaking(true);
      if (!wallet) return;
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      const mintAndStake = new ethers.Contract(
        MINT_AND_STAKE_ADDRESS,
        MintAndStakeABI.abi,
        signer
      );

      const tx = await mintAndStake.withdrawStake();
      await tx.wait();

      // Success notification
      toast({
        title: "Unstake Successful!",
        description: "Thank you, come again 🍗",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top",
        containerStyle: {
          background: "#00ff00",
          color: "black",
        },
      });

      updateBalances();
    } catch (err) {
      console.error("Unstake failed:", err);
      toast({
        title: "Error",
        description: "Failed to unstake. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsUnstaking(false);
      setGifVisible(false);
    }
  };

  // Add this function
  const addSauceToWallet = async () => {
    if (!wallets || wallets.length === 0) {
      toast({
        title: "Wallet Error",
        description: "Please connect your wallet first",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    try {
      if (!wallet) return;
      const provider = await wallet.getEthereumProvider();

      try {
        await provider.request({
          method: "metamask_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: MINT_AND_STAKE_ADDRESS,
              symbol: "SAUCE",
              decimals: 18,
            },
          } as any,
        });

        toast({
          title: "Success",
          description: "SAUCE token added to wallet",
          status: "success",
          duration: 5000,
          isClosable: true,
          position: "top",
        });
      } catch (error) {
        console.error("Specific error:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error adding token to wallet:", error);
      toast({
        title: "Error",
        description: "Failed to add token. Please try adding it manually.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    }
  };

  // Add new countdown function
  const updateStakingCountdown = useCallback(() => {
    const now = new Date();
    const diff = stakingDeadline.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeUntilStakingEnds("Staking Ended");
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeUntilStakingEnds(`${days}d ${hours}h ${minutes}m ${seconds}s`);
  }, [stakingDeadline]);

  // Add effect for staking countdown
  useEffect(() => {
    updateStakingCountdown();
    const interval = setInterval(updateStakingCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateStakingCountdown]);

  return (
    <>
      <Head>
        <title>turky.fun | Stake TURKY, Get SAUCE</title>
        <meta
          name="description"
          content="Stake your TURKY tokens until December 25th and receive SAUCE rewards. Make foodcoins great again."
        />

        {/* Open Graph / Social */}
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="turky.fun | Stake TURKY, Get SAUCE"
        />
        <meta
          property="og:description"
          content="Stake your TURKY tokens until December 25th and receive SAUCE rewards. Make foodcoins great again."
        />
        <meta property="og:image" content="/favicon.ico" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="turky.fun | Stake TURKY, Get SAUCE"
        />
        <meta
          name="twitter:description"
          content="Stake your TURKY tokens until December 25th and receive SAUCE rewards. Make foodcoins great again."
        />

        {/* Keywords */}
        <meta
          name="keywords"
          content="TURKY, SAUCE, staking, DeFi, cryptocurrency, rewards, tokens"
        />
      </Head>

      <Box minH="100vh" bg="black" py={6} position="relative">
        {authenticated && (
          <Box position="absolute" top={2} right={2} zIndex="dropdown">
            <Menu>
              <MenuButton
                as={Button}
                bg="rgba(0, 255, 0, 0.1)"
                border="1px solid"
                borderColor="#00ff00"
                color="#00ff00"
                _hover={{
                  bg: "rgba(0, 255, 0, 0.2)",
                }}
                _active={{
                  bg: "rgba(0, 255, 0, 0.2)",
                }}
                borderRadius="xl"
                px={3}
                h={8}
                fontSize="xs"
                rightIcon={<ChevronDownIcon color="#00ff00" w={3} h={3} />}
              >
                <Text fontSize="xs" fontFamily="mono">
                  {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
                </Text>
              </MenuButton>
              <MenuList
                bg="black"
                borderColor="#00ff00"
                borderWidth={1}
                boxShadow="0 0 10px #00ff00"
                p={3}
              >
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text color="whiteAlpha.700" fontSize="xs">
                      Staked TURKY Balance
                    </Text>
                    <Text color="#00ff00" fontSize="sm" fontWeight="bold">
                      {isLoadingBalances
                        ? "Loading..."
                        : `${parseFloat(stakedTurkyBalance).toFixed(2)} TURKY`}
                    </Text>
                  </Box>
                  <Box>
                    <Flex justify="space-between" align="center">
                      <Text color="whiteAlpha.700" fontSize="xs">
                        $SAUCE Balance
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        borderColor="#00ff00"
                        color="#00ff00"
                        _hover={{ bg: "rgba(0, 255, 0, 0.1)" }}
                        onClick={addSauceToWallet}
                      >
                        Add to Wallet
                      </Button>
                    </Flex>
                    <Text color="#00ff00" fontSize="sm" fontWeight="bold">
                      {isLoadingBalances
                        ? "Loading..."
                        : `${parseFloat(mstBalance).toFixed(2)} SAUCE`}
                    </Text>
                  </Box>
                  <Divider borderColor="whiteAlpha.300" />
                  <MenuItem
                    onClick={() => logout()}
                    bg="transparent"
                    color="red.500"
                    _hover={{
                      bg: "rgba(255, 0, 0, 0.1)",
                    }}
                  >
                    Disconnect
                  </MenuItem>
                </VStack>
              </MenuList>
            </Menu>
          </Box>
        )}

        <Container maxW="container.sm" px={containerPadding}>
          <VStack
            spacing={6}
            bg="rgba(0, 0, 0, 0.8)"
            borderRadius="2xl"
            p={containerPadding}
            border="1px"
            borderColor="whiteAlpha.200"
            backdropFilter="blur(10px)"
          >
            <Heading
              fontSize={headingSize}
              bgGradient="linear(to-r, #00ff00, #00cc00)"
              bgClip="text"
              letterSpacing="tight"
              textTransform="uppercase"
              fontWeight="black"
              textAlign="center"
            >
              turky.fun
            </Heading>

            <Box textAlign="center" py={2}>
              <Text color="whiteAlpha.700" fontSize="sm">
                Time left to stake
              </Text>
              <Text
                color="#00ff00"
                fontSize="xl"
                fontFamily="mono"
                fontWeight="bold"
              >
                {timeUntilStakingEnds}
              </Text>
            </Box>

            <Box textAlign="center" py={4}>
              <Text
                fontSize={textSize}
                fontWeight="bold"
                color="whiteAlpha.900"
                maxW="md"
                lineHeight="tall"
              >
                Stake
                <Badge
                  mx={2}
                  fontSize={badgeSize}
                  bg="transparent"
                  border="1px solid #00ff00"
                  color="#00ff00"
                  px={2}
                >
                  $TURKY
                </Badge>
                <Box as="span" display={{ base: "block", md: "inline" }}>
                  until 25 Dec & receive
                  <Badge
                    ml={{ base: 0, md: 2 }}
                    mt={{ base: 2, md: 0 }}
                    fontSize={badgeSize}
                    bg="transparent"
                    border="1px solid #00ff00"
                    color="#00ff00"
                    px={2}
                    display={{ base: "inline-block", md: "inline" }}
                  >
                    $SAUCE
                  </Badge>
                </Box>
              </Text>
            </Box>

            {!authenticated ? (
              <Button
                onClick={() => login()}
                size="lg"
                bg="transparent"
                border="2px solid"
                borderColor="#00ff00"
                color="#00ff00"
                w="full"
                h={buttonHeight}
                fontSize={textSize}
                borderRadius="xl"
                _hover={{
                  bg: "rgba(0, 255, 0, 0.1)",
                }}
                animation={glowAnimation}
              >
                Connect Wallet
              </Button>
            ) : (
              <Box w="full">
                <NumberInput
                  value={stakeAmount}
                  onChange={(value) => setStakeAmount(value)}
                  min={1}
                  clampValueOnBlur={true}
                  mb={4}
                  borderColor="#00ff00"
                  color="#00ff00"
                >
                  <NumberInputField
                    bg="transparent"
                    border="2px solid"
                    borderColor="#00ff00"
                    color="#00ff00"
                    h={buttonHeight}
                    fontSize={textSize}
                    textAlign="center"
                    _hover={{
                      borderColor: "#00ff00",
                    }}
                    _focus={{
                      borderColor: "#00ff00",
                      boxShadow: "0 0 10px #00ff00",
                    }}
                  />
                  <NumberInputStepper>
                    <NumberIncrementStepper
                      border="none"
                      color="#00ff00"
                      _hover={{
                        bg: "rgba(0, 255, 0, 0.1)",
                      }}
                    />
                    <NumberDecrementStepper
                      border="none"
                      color="#00ff00"
                      _hover={{
                        bg: "rgba(0, 255, 0, 0.1)",
                      }}
                    />
                  </NumberInputStepper>
                </NumberInput>

                <Button
                  onClick={handleApproveMintLock}
                  isDisabled={!authenticated || !userAddress || isStaking}
                  size="lg"
                  w="full"
                  h={buttonHeight}
                  fontSize={textSize}
                  bg="transparent"
                  border="2px solid"
                  borderColor="#00ff00"
                  color="#00ff00"
                  borderRadius="xl"
                  _hover={{
                    bg: "rgba(0, 255, 0, 0.1)",
                  }}
                  _disabled={{
                    opacity: 0.5,
                    cursor: "not-allowed",
                  }}
                  animation={glowAnimation}
                >
                  {isApproving ? (
                    <Flex gap={2} align="center">
                      <Spinner size="sm" color="#00ff00" />
                      <Text>Approving...</Text>
                    </Flex>
                  ) : isStaking ? (
                    <Flex gap={2} align="center">
                      <Spinner size="sm" color="#00ff00" />
                      <Text>Staking...</Text>
                    </Flex>
                  ) : needsApproval ? (
                    "Approve Spend"
                  ) : (
                    `Stake ${stakeAmount} TURKY, recieve ${stakeAmount} SAUCE`
                  )}
                </Button>

                {gifVisible &&
                  isMinting &&
                  !timeUntilUnlock.includes("Unlocked") && (
                    <Box
                      position="relative"
                      borderRadius="2xl"
                      overflow="hidden"
                      border="2px solid"
                      borderColor="#00ff00"
                      animation={glowAnimation}
                      mt={6}
                    >
                      <Image
                        src="/turkyshake.gif"
                        alt="Turky Shake"
                        width={videoSize}
                        height={videoSize}
                        style={{
                          objectFit: "cover",
                          width: "100%",
                          height: "100%",
                        }}
                      />
                    </Box>
                  )}

                <Divider my={6} borderColor="whiteAlpha.200" />

                <VStack spacing={4} w="full">
                  <Box textAlign="center">
                    <Text color="whiteAlpha.700" fontSize="sm">
                      Time until unlock
                    </Text>
                    <Text
                      color="#00ff00"
                      fontSize="2xl"
                      fontFamily="mono"
                      fontWeight="bold"
                    >
                      {timeUntilUnlock}
                    </Text>
                  </Box>

                  <Button
                    onClick={handleUnstake}
                    isDisabled={
                      !authenticated ||
                      !userAddress ||
                      new Date() < unlockDate ||
                      parseFloat(stakedTurkyBalance) === 0 ||
                      isUnstaking
                    }
                    size="lg"
                    w="full"
                    h={buttonHeight}
                    fontSize={textSize}
                    bg="transparent"
                    border="2px solid"
                    borderColor="#00ff00"
                    color="#00ff00"
                    borderRadius="xl"
                    _hover={{
                      bg: "rgba(0, 255, 0, 0.1)",
                    }}
                    _disabled={{
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }}
                    animation={glowAnimation}
                  >
                    {isUnstaking ? (
                      <Flex gap={2} align="center">
                        <Spinner size="sm" color="#00ff00" />
                        <Text>Unstaking...</Text>
                      </Flex>
                    ) : new Date() < unlockDate ? (
                      "Locked"
                    ) : parseFloat(stakedTurkyBalance) === 0 ? (
                      "No tokens staked"
                    ) : (
                      "Unstake TURKY"
                    )}
                  </Button>
                </VStack>
              </Box>
            )}
          </VStack>
        </Container>
      </Box>
    </>
  );
}

export default MainPage;
