var AdministrationBoard = artifacts.require("./AdministrationBoard.sol");
var OrcaToken = artifacts.require("./OrcaToken.sol");

contract('AdministrationBoard.sol', function (accounts) {

    it("Sould not let add more than 5 additional administration board owners", async function () {
        var transferError;
        let administrationBoard = await AdministrationBoard.new();
        for(var i = 1; i <= 5; i++){
            await administrationBoard.addOwner(web3.eth.accounts[i]);
        }
        try {
            let transfer = await administrationBoard.addOwner(web3.eth.accounts[7]);
        } catch (error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when added more than 5 additional owner');

    });

    it("Max 5 additional administration board owners can be added to constructor", async function () {
        var transferError;
        let administrationBoard = await AdministrationBoard.new(
            [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3], web3.eth.accounts[4], web3.eth.accounts[5]]
        );
        assert.equal((await administrationBoard.getAdministrationBoardOwners()).length, 6, 'The size of administration board owners has to be 6 (5 additional owners + 1 main owner)');

        try {
            await AdministrationBoard.new(
                [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3], web3.eth.accounts[4], web3.eth.accounts[5], web3.eth.accounts[6]]
            );
            let transfer = await administrationBoard.addOwner(web3.eth.accounts[7]);
        } catch (error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when added more than 5 additional owner to constructor');

    });

    it("Only main owner can add additional owners", async function () {
        var transferError;
        let administrationBoard = await AdministrationBoard.new();
        await administrationBoard.addOwner(web3.eth.accounts[1]);

        try {
            let transfer = await administrationBoard.transferFrom(web3.eth.accounts[2], {from: accounts[1], gass: 3000000});
        } catch (error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when not main owner tries to add additional owners');

    });

    it("Additional owner removal needs three confirmations which one of them is master owner", async function () {

        let administrationBoard = await AdministrationBoard.new();
        for(var i = 1; i <=4; i++){
            await administrationBoard.addOwner(web3.eth.accounts[i]);
        }
        let owners = await administrationBoard.getAdministrationBoardOwners();

        assert.equal(owners.length, 5, "There are 5 administration board owners");

        administrationBoard.removeOwner(web3.eth.accounts[1]);
        owners = await administrationBoard.getAdministrationBoardOwners();
        assert.equal(owners.length, 5, "There are 5 administration board owners after deletion");

        administrationBoard.removeOwner(web3.eth.accounts[1], {from: accounts[2], gass: 3000000});
        owners = await administrationBoard.getAdministrationBoardOwners();
        assert.equal(owners.length, 5, "There are 5 administration board owners after deletion");

        administrationBoard.removeOwner(web3.eth.accounts[1], {from: accounts[3], gass: 3000000});
        owners = await administrationBoard.getAdministrationBoardOwners();
        assert.equal(owners.length, 4, "There are 4 administration board owners after deletion");
    });

    it("Tokens cannot be released to investors more than 75% of total supply", async function () {
        var transferError;
        let administrationBoard = await AdministrationBoard.new();
        let crowdsaleSupply = web3.toWei(750000000, 'ether');
        await administrationBoard.addTokenOwners([web3.eth.accounts[5]], [crowdsaleSupply]);

        try {
            await administrationBoard.addTokenOwners([web3.eth.accounts[5]], [1]);
        } catch (error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when token supply exceeds crowdsale supply');
    });

    it("Tokens will be added to investors by provided token supply data", async function () {

        let administrationBoard = await AdministrationBoard.new();

        let investorsSize = 15;
        let investors = new Array(investorsSize);
        let investorsTokenSupply = new Array(investorsSize);
        let investorAddresses = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3], web3.eth.accounts[4], web3.eth.accounts[5]];

        for(var i = 0; i < investorsSize; i++){
            investors[i] = investorAddresses[i % 5];
            investorsTokenSupply[i] =  web3.toWei(7500, 'ether');
        }

        await administrationBoard.addTokenOwners(investors, investorsTokenSupply);
        let crowdsaleParticipants = await administrationBoard.getCrowdsaleTokenOwners();
        let assignedTokenSupply = await administrationBoard.getAssignedTokensSupply();

        assert.equal(crowdsaleParticipants.length, 5, "In crowdsale participated only 5 investors");
        assert.equal(assignedTokenSupply.toNumber(), web3.toWei(7500, 'ether') * investorsSize, "All tokens assigned to investors");

        for(var i = 0; i < investorsSize; i++){
            let supply = await administrationBoard.getCrowdsaleParticipantTokenSupply(investors[i]);
            assert.equal(supply.toNumber(), web3.toWei(7500, 'ether') * 3, "Each investor has eqaul number of tokens");
        }

    });

    it("Token release must confirm 2 additional administration board owners + master owner", async function () {
        let administrationBoard = await AdministrationBoard.new();
        let tokenAddress = await administrationBoard.tokenAddress();
        let token = await OrcaToken.at(tokenAddress);
        let investorsSize = 15;
        let investors = new Array(investorsSize);
        let investorsTokenSupply = new Array(investorsSize);
        let investorAddresses = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3], web3.eth.accounts[4], web3.eth.accounts[5]];

        for (var i = 0; i < investorsSize; i++) {
            investors[i] = investorAddresses[i % 5];
            investorsTokenSupply[i] =  web3.toWei(7500, 'ether');
        }
        await administrationBoard.addTokenOwners(investors, investorsTokenSupply);

        for (var j = 1; j <= 5; j++) {
            await administrationBoard.addOwner(web3.eth.accounts[j]);
        }
        await administrationBoard.confirmTokenRelease();
        await administrationBoard.confirmTokenRelease({from: accounts[1]});
        await administrationBoard.confirmTokenRelease({from: accounts[2]});
        for (var i = 0; i < investorsSize; i++) {
            let supply = await token.balanceOf(investors[i]);
            assert.equal(supply.toNumber(), web3.toWei(7500, 'ether') * 3, "Each investor has eqaul number of tokens");
        }

        let supply = await token.balanceOf(web3.eth.accounts[0]);
        assert.equal(supply.toNumber(), web3.toWei(1000000000, 'ether') - (web3.toWei(7500, 'ether') * 15), "Main owner has all not released tokens");
    });

    it("Token release confirmation can be revoked", async function(){
        let administrationBoard = await AdministrationBoard.new();
        let boardMembers = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];
        let investorsSize = 3;
        let investors = new Array(investorsSize);
        let investorsTokenSupply = new Array(investorsSize);

        for (var i = 0; i < boardMembers.length; i++) {
            await administrationBoard.addOwner(boardMembers[i]);
        }

        for (var i = 0; i < investorsSize; i++) {
            investors[i] = boardMembers[i];
            investorsTokenSupply[i] =  web3.toWei(7500, 'ether');
        }

        await administrationBoard.addTokenOwners(investors, investorsTokenSupply);

        await administrationBoard.confirmTokenRelease();
        await administrationBoard.confirmTokenRelease({from: accounts[1]});
        let releaseConfirmations = await administrationBoard.confirmedTokenReleaseCount();
        assert.equal(releaseConfirmations.toNumber(), 2, "Token release confirmed 2 administration board owners");

        await administrationBoard.revokeTokenReleaseConfirmation({from: accounts[1]});
        releaseConfirmations = await administrationBoard.confirmedTokenReleaseCount();
        assert.equal(releaseConfirmations.toNumber(), 1, "Token release confirmed 1 administration board owners");
    });

    it("Token release confirmation cannot be revoked by owner who not confirmed token release earlier", async function(){
        let transferError;
        let administrationBoard = await AdministrationBoard.new();
        let boardMembers = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];

        for (var i = 0; i < boardMembers.length; i++) {
            await administrationBoard.addOwner(boardMembers[i]);
        }

        await administrationBoard.confirmTokenRelease();
        await administrationBoard.confirmTokenRelease({from: accounts[1]});

        try {
            await administrationBoard.revokeTokenReleaseConfirmation({from: accounts[2]});
        } catch (error) {
            transferError = error;
        }

        assert.notEqual(transferError, undefined, 'Error must be thrown, when owner, who did not confirmed release tries to revoke it');
    });

    it("To reset token owners list, 2 additional board owners  + main owner has to confirm", async function(){
        let administrationBoard = await AdministrationBoard.new();
        let boardMembers = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];
        let investorsSize = 3;
        let investors = new Array(investorsSize);
        let investorsTokenSupply = new Array(investorsSize);

        for (var i = 0; i < boardMembers.length; i++) {
            await administrationBoard.addOwner(boardMembers[i]);
        }

        for (var i = 0; i < investorsSize; i++) {
            investors[i] = boardMembers[i];
            investorsTokenSupply[i] =  web3.toWei(7500, 'ether');
        }

        await administrationBoard.addTokenOwners(investors, investorsTokenSupply);
        let crowdsaleParticipants = (await administrationBoard.getCrowdsaleTokenOwners()).length;
        assert.equal(crowdsaleParticipants, investorsSize, 'Size of crowdsale investors has to be equal to 3');
        await administrationBoard.resetTokenOwners();
        await administrationBoard.resetTokenOwners({from: accounts[1]});
        assert.equal((await administrationBoard.getCrowdsaleTokenOwners()).length, crowdsaleParticipants, 'Size of crowdsale investors remains same, when only one additional owner and master owner confirmed tokens owners reset');
        await administrationBoard.resetTokenOwners({from: accounts[2]});
        assert.equal((await administrationBoard.getCrowdsaleTokenOwners()).length, 0, 'Crowdsale participants were reset');


        /*Check that master owner confirmation is mandatory for token owners reset*/
        await administrationBoard.addTokenOwners(investors, investorsTokenSupply);
        assert.equal((await administrationBoard.getCrowdsaleTokenOwners()).length, 3, 'Size of crowdsale investors has to be equal to 3');
        await administrationBoard.resetTokenOwners({from: accounts[1]});
        await administrationBoard.resetTokenOwners({from: accounts[2]});
        await administrationBoard.resetTokenOwners({from: accounts[3]});
        assert.equal((await administrationBoard.getCrowdsaleTokenOwners()).length, 3, 'Size of crowdsale investors has to be equal to 3');

        await administrationBoard.resetTokenOwners();
        assert.equal((await administrationBoard.getCrowdsaleTokenOwners()).length, 0, 'Crowdsale participants were reset');
    });

    it("Token owners reset confirmation can be revoked", async function(){
        let transferError;
        let administrationBoard = await AdministrationBoard.new();
        let boardMembers = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];
        let investorsSize = 3;
        let investors = new Array(investorsSize);
        let investorsTokenSupply = new Array(investorsSize);

        for (var i = 0; i < boardMembers.length; i++) {
            await administrationBoard.addOwner(boardMembers[i]);
        }

        for (var i = 0; i < investorsSize; i++) {
            investors[i] = boardMembers[i];
            investorsTokenSupply[i] =  web3.toWei(7500, 'ether');
        }

        await administrationBoard.addTokenOwners(investors, investorsTokenSupply);

        await administrationBoard.resetTokenOwners();
        await administrationBoard.resetTokenOwners({from: accounts[1]});
        assert.equal((await administrationBoard.whoConfirmedTokenOwnersReset()).length, 2, "Two owners confirmed token owners list reset");

        await administrationBoard.revokeOwnersTokenReset({from: accounts[1]});
        assert.equal((await administrationBoard.whoConfirmedTokenOwnersReset()).length, 1, "Two owners confirmed token owners list reset");

        try {
            await administrationBoard.revokeOwnersTokenReset({from: accounts[1]});
        } catch (error) {
            transferError = error;
        }

        assert.notEqual(transferError, undefined, 'Error must be thrown, when owner, who did not confirmed token owners reset tries to revoke it');

    });

    it("Ether cannot be sent to administration board contract", async function() {
        let transferError;
        let administrationBoard = await AdministrationBoard.new();

        try {
            await administrationBoard.sendTransaction(
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



});