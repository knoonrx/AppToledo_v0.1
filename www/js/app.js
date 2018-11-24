let ipt = angular.module('app', [])
    .factory('produtosAPI', $http => {
        return {
            GetProdutos: () => $http.get('http://alessandro.softhotelaria.com/api/Produtos/Listar'),
        }
    })
    .factory('databaseAPI', ($q) => {
        return {
            showAll: (databaseObject, tabelaNome) => {
                let deferred = $q.defer();
                databaseObject.transaction((tx) => tx.executeSql('SELECT *  FROM ' + tabelaNome, [], (tx, results) => deferred.resolve(Array.from(results.rows))));
                return deferred.promise;
            }
        };
    })
    .factory('enviarAPI', $http => {
        //$http.defaults.headers.post["Content-Type"] = "application/json";
        return {
            postImage: dados => $http({
                url: 'http://alessandro.softhotelaria.com/api/UploadCustomerImage',
                method: 'POST',
                data: JSON.stringify(dados),
            })
            .then(response =>  console.log(response)),
            enviarColeta: dados => $http({
                url: 'http://alessandro.softhotelaria.com/api/Coletas/inserir',
                method: 'POST',
                data: JSON.stringify(dados),
            })
            .then(response =>  console.log(response))
            .catch(error => console.log(error))
        }
    })
    .controller('IndexController',
        ['$scope', '$q', '$http', 'produtosAPI', 'databaseAPI', 'enviarAPI',
            ($scope, $q, $http, produtosAPI, databaseAPI, enviarAPI) => {
                const Database_Name = 'DatabaseIPT';
                const Version = 1.0;
                const Text_Description = '';
                const Database_Size = 2 * 1024 * 1024;
                const dbObj = openDatabase(Database_Name, Version, Text_Description, Database_Size);
                const elem = document.querySelector('.modal');
                const instance = M.Modal.init(elem);
                const requestProdutosAPI = () => {
                    produtosAPI.GetProdutos().then(produtos => {
                        produtos.data.map(p => dbObj.transaction(tx => tx.executeSql('INSERT INTO Produtos( Id, Nome, Marca ,Codigobarras, Setor ) VALUES (?,?,?,?,?)', [p.Id, p.Nome, p.Marca, p.Codigobarras, p.Setor])))
                    });
                };
                const scanCode = () => {
                    cordova.plugins.barcodeScanner.scan(
                          function (result) {
                              $scope.mostrarProdutoBarCod = $scope.produtosLista.map(p => {
                                  if (p.Codigobarras == result.text) {
                                      showToast('Produto encontrado por favor aguarde...')

                                      $scope.ProdutoBarCode = p.Codigobarras;
                                      $scope.ProdutoNome = p.Nome;
                                      $scope.ProdutoMarca = p.Marca;
                                      $scope.ProdutoId = p.Id;
                                      $scope.produto = p;
                                      document.getElementById('preco').focus();
                                      instance.open();
                                  }
                              });

                          },
                          function (error) {
                              alert("Não foi possível escanear o produto: " + error);
                          },
                          {
                              preferFrontCamera: false, // iOS and Android
                              showFlipCameraButton: true, // iOS and Android
                              showTorchButton: true, // iOS and Android
                              torchOn: false, // Android, launch with the torch switched on (if available)
                              saveHistory: true, // Android, save scan history (default false)
                              prompt: "Place a barcode inside the scan area", // Android
                              resultDisplayDuration: 500, // Android, display scanned text for X ms. 0 suppresses it entirely, default 1500
                              //formats: "QR_CODE,PDF_417", // default: all but PDF_417 and RSS_EXPANDED
                              orientation: "landscape", // Android only (portrait|landscape), default unset so it rotates with the device
                              disableAnimations: true, // iOS
                              disableSuccessBeep: false // iOS and Android
                          }
                       );
                }
                const getListaProdutosPromise = (tabela) => {
                    let deferred = $q.defer();
                    databaseAPI.showAll(dbObj, tabela).then(listview => deferred.resolve(listview));
                    return deferred.promise;
                };
                const refreshListaProdutos = () => {
                    $scope.showColeta = false;
                    $scope.showProdutos = true;
                    return $q.all([getListaProdutosPromise('Produtos'), getListaProdutosPromise('ItemPesquisado')])
                        .then(function (dataList) {

                            if (dataList[1].length < 1)
                                return $scope.produtosLista = dataList[0];

                            let difference = dataList[0].map(d => {
                                if (!dataList[1].find(e => parseInt(e.Pid) === d.Id)) return d;
                            }).filter(Boolean);

                            return $q.all(difference).then(d => $scope.produtosLista = d);
                        });
                };
                const formataDinheiro = (valor) => {
                    let formatter = new Intl.NumberFormat('pt-br', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 2,
                    });

                    return formatter.format(parseFloat(valor));
                };
                const showToast = (mensagem, callback) => {
                    $q.all(M.toast({ html: '<span>' + mensagem + '</span> <button class="btn-flat toast-action">&times;</button>', completeCallback: () => callback })).then(e => {
                        document.getElementById('toast-container').addEventListener('click', e => M.Toast.dismissAll());
                    });
                };
                const assinar = () => {
                    const Signature = cordova.require('nl.codeyellow.signature.Signature');
                    Signature.getSignature(
                        function (imgData) {
                            /* This is the "success" callback. */
                            if (!imgData) return; // User clicked cancel, we got no image data.

                            var canvas = document.getElementById('signature'),
                            ctx = canvas.getContext('2d');
                            canvas.width = imgData.width;
                            canvas.height = imgData.height;
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.putImageData(imgData, 0, 0);
                        }, function (msg) {
                            /* This is the "error" callback. */
                            alert('Não foi possível coletar sua assinatura: ' + msg);
                        },
                        /* This final string is optional and defaults to a similar string. */
                        'Por favor deixe sua assinatura logo abaixo');
                };
                const enviarImagem = () => {
                    var dados = {};
                    dados.Description = "";
                    dados.ImageData = document.getElementById("preview").src.replace("data:image/png;base64,", "");

                    return enviarAPI.postComunicado(dados);
                };
                const to_image = () => {
                    const canvas = document.getElementById("signature");
                    document.getElementById("preview").src = canvas.toDataURL();
                    alert(document.getElementById("preview").src);
                    return enviarImagem();
                };

                $scope.clickToImage = () => to_image();
                $scope.clickToSign = () => assinar();
                $scope.clickToScan = () => scanCode();
                $scope.produtos = [];
                $scope.formData = {}; // todos os campos do formulário
                $scope.CurrentDate = new Date();
                $scope.enviarAPI = () => enviarAPI.enviarColeta($scope.listarColeta)
                // faz a requisição da api e salva no banco local
                $scope.baixarListaDaAPI = () => {
                    requestProdutosAPI();
                    showToast('O banco de dados está carregado agora.')
                };
                // no clique do botão listar exibe os produtos na tela
                $scope.listarProdutos = () => refreshListaProdutos();
                // salva o item coletado no banco de dados local
                $scope.salvarItemColetado = () => {
                    // validar se o codigo de barras do input é igual ao que está no banco

                    let cDia = document.getElementsByName("DiaDaColeta")[0].value;
                    let cPid = document.getElementsByName("ProdutoId")[0].value;
                    let cPreco = document.getElementsByName("ProdutoPreco")[0].value;
                    let cColetaId = 99; // id da coleta, estatica por enquanto.
                    let cMercadoId = 33; // id do mercado, estatica por enquanto.

                    dbObj.transaction(tx => tx.executeSql('INSERT INTO ItemPesquisado( Pid, MercadoId, ColetaID,  Preco, Dia ) VALUES (?,?,?,?,?)', [cPid, cMercadoId, cColetaId, cPreco, cDia]));
                    showToast('Salvo com sucesso!')
                    document.getElementsByName("DiaDaColeta")[0].value = new Date();
                    document.getElementsByName("ProdutoId")[0].value = '';
                    document.getElementsByName("ProdutoPreco")[0].value = '';
                    refreshListaProdutos();
                    instance.close();
                };
                // mostra o formulário de coleta de produto
                $scope.mostrarProduto = (pid, pnome, pmarca) => {
                    instance.open();

                    $scope.ProdutoNome = pnome;
                    $scope.ProdutoMarca = pmarca;
                    $scope.ProdutoId = pid;
                    $scope.produto = $scope.produtos
                        .filter(p => p.Id === pid)
                        .pop();
                    document.getElementById('preco').focus();
                };
                // lista os produtos já coletados
                $scope.listarColeta = () => {
                    return $q.all([getListaProdutosPromise('ItemPesquisado'), getListaProdutosPromise('Produtos')])
                        .then(function (dataList) {
                            let difference = dataList[1].map(d => {
                                let item = [];
                                if (item = dataList[0].find(e => parseInt(e.Pid) === d.Id)) {
                                    $scope.showColeta = true;
                                    $scope.showProdutos = false;
                                    return {
                                        Codigobarras: d.Codigobarras,
                                        Id: d.Id,
                                        Marca: d.Marca,
                                        Nome: d.Nome,
                                        Setor: d.Setor,
                                        ColetaID: item.ColetaID,
                                        Dia: item.Dia,
                                        MercadoId: item.MercadoId,
                                        Pid: item.Pid,
                                        Preco: formataDinheiro(item.Preco),
                                        id: item.id,
                                    };
                                }
                            }).filter(Boolean);

                            return $q.all(difference).then(d => $scope.produtosColetados = d);
                        });
                };
                // limpar dados do banco de dados
                $scope.limparBanco = () => {
                    dbObj.transaction((tx) => {
                        tx.executeSql('DELETE FROM Produtos');
                        tx.executeSql('DELETE FROM ItemPesquisado');
                        showToast('O banco de dados está limpo.', $scope.$apply(() => $scope.produtosLista = []))
                    });
                }
            }
        ]);