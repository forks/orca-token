var OrcaToken = artifacts.require("./OrcaToken.sol");
var ERC23Receiver = artifacts.require("./helpers/ERC23ReceiverMock.sol");


contract('OrcaToken.sol', function (accounts) {

    it('Token contract has to be constructable', async function() {
        await OrcaToken.new();
    });

    it("Token contract should return the correct total supply after construction", async function() {
        let TokenContract = await OrcaToken.new(accounts[0]);
        let totalSupply = await TokenContract.totalSupply();

        assert.equal(totalSupply.toNumber(), web3.toWei(1000000000, 'ether'));
    });

    it('Token should throw an error when trying to transfer to 0x0', async function() {
        let transferError;
        let TokenContract = await OrcaToken.new(accounts[0]);

        try {
            let transfer = await TokenContract.transfer(0x0, 100);
            assert.fail('should have thrown before');
        } catch(error) {
            transferError = error;
        }

        assert.notEqual(transferError, undefined, 'Error must be thrown, when trying to transfer to 0x0');
    });

    it('Token should throw an error when trying to transferFrom to 0x0', async function() {
        let transferError;
        let TokenContract = await OrcaToken.new(accounts[0]);
        await TokenContract.approve(accounts[1], 100);

        try {
            let transfer = await TokenContract.transferFrom(accounts[0], 0x0, 100, {from: accounts[1]});
            assert.fail('should have thrown before');
        } catch(error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when trying to transferFrom to 0x0');
    });

    it("Token creator at the start has all tokens", function () {
        var TokenContract;
        var ownerTokenBalance;
        return OrcaToken.new(web3.eth.accounts[0]).then(function (instance) {
            TokenContract = instance;
            return TokenContract.balanceOf(web3.eth.accounts[0], {from: accounts[0], gass: 3000000})
        }).then(function (balance){
            ownerTokenBalance = balance.toNumber();
            return TokenContract.totalSupply();
        }).then(function (totalSupply) {
            assert.equal(ownerTokenBalance, totalSupply, "Owner of token contract has all tokens");
        });
    });

    it("Token should return correct balances after transfer", async function() {
        let TokenContract = await OrcaToken.new(accounts[0]);
        let transfer = await TokenContract.transfer(accounts[1], web3.toWei(100, 'ether'));
        let balance0 = await TokenContract.balanceOf(accounts[0]);
        assert.equal(balance0.toNumber(), web3.toWei(999999900, 'ether'));

        let balance1 = await TokenContract.balanceOf(accounts[1]);
        assert.equal(balance1.toNumber(), web3.toWei(100, 'ether'));
    });

    it("Should return the correct allowance amount after approval",  function() {
        var TokenContract;
        return OrcaToken.new().then(function (instance) {
            TokenContract = instance;
            return TokenContract.approve(web3.eth.accounts[1], web3.toWei(100, 'ether'), {from: accounts[0], gass: 3000000})
        }).then(function (tokenApprove){

            return TokenContract.allowance(web3.eth.accounts[0], web3.eth.accounts[1]);
        }).then(function (allowance) {
            assert.equal(allowance, web3.toWei(100, 'ether'), "Allowance must be the same as approved");
        });
    });

    it("Should throw an error when trying to transfer more than allowed", async function() {
        let token = await OrcaToken.new();
        let approve = await token.approve(web3.eth.accounts[1], web3.toWei(99, 'ether'),  {from: accounts[0], gass: 3000000});
        var transferError;
        try {
            let transfer = await token.transferFrom(web3.eth.accounts[0], web3.eth.accounts[2], web3.toWei(100, 'ether'), {from: accounts[1], gass: 3000000});
        } catch (error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown');
    });

    it("Should return correct balances after transfering from another account", function() {
        var TokenContract;
        var balance0, balance1, balance2;

        return OrcaToken.new(web3.eth.accounts[0]).then(function (instance) {
            TokenContract = instance;
            return TokenContract.approve(web3.eth.accounts[1], web3.toWei(100, 'ether'), {from: accounts[0], gass: 3000000})
        }).then(function () {
            return TokenContract.transferFrom(web3.eth.accounts[0], web3.eth.accounts[2], web3.toWei(100, 'ether'), {from: accounts[1], gass: 3000000});
        }).then(function () {
            return TokenContract.balanceOf(web3.eth.accounts[0]);
        }).then(function (balance) {
            balance0 = balance.toNumber();
            return TokenContract.balanceOf(web3.eth.accounts[1]);
        }).then(function (balance) {
            balance1 = balance.toNumber();
            return TokenContract.balanceOf(web3.eth.accounts[2]);
        }).then(function (balance) {
            balance2 = balance.toNumber();
            assert.equal(balance0, web3.toWei(1000000000 - 100, 'ether'));
            assert.equal(balance1, 0);
            assert.equal(balance2, web3.toWei(100, 'ether'));
        });
    });

    it("Tokens may by sent to another contract if it implement ERC23Receiver standard", async function() {
        let tokenReceiver = await ERC23Receiver.new(true);
        var TokenContract = await OrcaToken.new(web3.eth.accounts[0]);
        await TokenContract.transfer(tokenReceiver.address, web3.toWei(1, 'ether'));

        assert.equal((await TokenContract.balanceOf(tokenReceiver.address)).toNumber(), web3.toWei(1, 'ether'), "Contract has to receive tokens");
    });

    it("Tokens may not by sent to another contract if it does not implement ERC23Receiver standard", async function() {
        let tokenReceiver = await ERC23Receiver.new(false);
        var TokenContract = await OrcaToken.new(web3.eth.accounts[0]);
        await TokenContract.transfer(tokenReceiver.address, web3.toWei(1, 'ether'));

        assert.equal((await TokenContract.balanceOf(tokenReceiver.address)).toNumber(), web3.toWei(1, 'ether'), "Contract has to receive tokens");
    });

    it("Ether cannot be sent to token contract", async function() {
        let transferError;
        let TokenContract = await OrcaToken.new();

        try {
            await TokenContract.sendTransaction(
                {
                    from: web3.eth.accounts[0],
                    to: contract.address,
                    value: web3.toWei(4, 'ether'),
                }
            );
        } catch (error) {
            transferError = error;
        }

        assert.notEqual(transferError, undefined, 'Error must be thrown, when user tries to send eher to contract');
    });

    it('Should throw an error when trying to transfer more than balance', async function() {
        let transferError;
        let token = await OrcaToken.new(web3.eth.accounts[0]);
        try {
            await token.transfer(web3.eth.accounts[1], web3.toWei(1000000001, 'ether'));
        } catch(error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when user tries to send more tokens when user has');
    });


});