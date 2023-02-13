const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("FundMe", async function() {
      let fundMe;
      let deployer;
      let mockV3Aggregator;
      const amountFunded = ethers.utils.parseEther("1"); // 1 ETH
      beforeEach(async function() {
        //deploy our fundMe contract using Hardhat-deploy
        // const accounts = await ethers.getSigners();
        // const accountZero = accounts[0];
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        fundMe = await ethers.getContract("FundMe", deployer);
        mockV3Aggregator = await ethers.getContract(
          "MockV3Aggregator",
          deployer
        );
      });

      describe("constructor", async function() {
        it("sets the aggregator addresses correctly", async function() {
          const response = await fundMe.getPriceFeed();
          assert.equal(response, mockV3Aggregator.address);
        });
      });

      describe("fund", async function() {
        it("fails if you don't send enough ETH", async function() {
          await expect(fundMe.fund()).to.be.revertedWith(
            "You need to spend more ETH!"
          );
        });
        it("updated the amount funded data structure", async function() {
          await fundMe.fund({ value: amountFunded });
          const response = await fundMe.getAddressToAmountFunded(deployer);
          assert.equal(response.toString(), amountFunded.toString());
        });
        it("adds funder to array of the funder", async function() {
          await fundMe.fund({ value: amountFunded });
          const funder = await fundMe.getFunder(0);
          assert.equal(funder, deployer);
        });
      });

      describe("withdraw", async function() {
        beforeEach(async function() {
          await fundMe.fund({ value: amountFunded });
        });
        it("withdraw ETH from a single funder", async function() {
          // arrange
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          // act
          const transactionResponse = await fundMe.withdraw();
          const transactionReceipt = await transactionResponse.wait(1);
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          const closingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );

          const closingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );
          // assert
          assert.equal(closingFundMeBalance, 0);
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            closingDeployerBalance.add(gasCost).toString()
          );
        });

        it("allows us to withdraw with multiple getFunder", async function() {
          // arrange
          const accounts = await ethers.getSigners();
          for (let i = 1; i < 6; i++) {
            const fundMeConnectedContract = await fundMe.connect(accounts[i]);
            await fundMeConnectedContract.fund({ value: amountFunded });
          }
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );
          // act
          const transactionResponse = await fundMe.withdraw();
          const transactionReceipt = await transactionResponse.wait(1);
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          const closingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );

          const closingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          // assert
          assert.equal(closingFundMeBalance, 0);
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            closingDeployerBalance.add(gasCost).toString()
          );

          // make sure getFunder are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted;
          for (i = 1; i < 6; i++) {
            assert.equal(
              await fundMe.getAddressToAmountFunded(accounts[i].address),
              0
            );
          }
        });

        it("cheaper withdraw ETH from a single funder", async function() {
          // arrange
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          // act
          const transactionResponse = await fundMe.cheaperWithdraw();
          const transactionReceipt = await transactionResponse.wait(1);
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          const closingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );

          const closingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );
          // assert
          assert.equal(closingFundMeBalance, 0);
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            closingDeployerBalance.add(gasCost).toString()
          );
        });

        it("cheaper withdraw testing", async function() {
          // arrange
          const accounts = await ethers.getSigners();
          for (let i = 1; i < 6; i++) {
            const fundMeConnectedContract = await fundMe.connect(accounts[i]);
            await fundMeConnectedContract.fund({ value: amountFunded });
          }
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );
          // act
          const transactionResponse = await fundMe.cheaperWithdraw();
          const transactionReceipt = await transactionResponse.wait(1);
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          const closingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );

          const closingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          // assert
          assert.equal(closingFundMeBalance, 0);
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            closingDeployerBalance.add(gasCost).toString()
          );

          // make sure getFunder are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted;
          for (i = 1; i < 6; i++) {
            assert.equal(
              await fundMe.getAddressToAmountFunded(accounts[i].address),
              0
            );
          }
        });

        it("only allows owner to withdraw", async function() {
          const accounts = await ethers.getSigners();
          const fundMeConnectedContract = await fundMe.connect(accounts[1]);
          await expect(
            fundMeConnectedContract.withdraw()
          ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner");
        });
      });
    });
